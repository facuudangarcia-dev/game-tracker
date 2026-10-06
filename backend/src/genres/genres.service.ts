import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type EntityManager, In, Repository } from 'typeorm';
import type { CatalogProvider } from '../catalog/catalog-provider';
import type { CatalogGenreRef } from '../catalog/game-catalog-provider';
import { GenreExternalId } from './genre-external-id.entity';
import { Genre } from './genre.entity';

@Injectable()
export class GenresService {
  constructor(@InjectRepository(Genre) private readonly genres: Repository<Genre>) {}

  findAll(): Promise<Genre[]> {
    return this.genres.find({ order: { name: 'ASC' } });
  }

  /**
   * Returns our genres for a provider's genre refs. Unknown genres are created
   * with the provider's name until translated (decision #25). Safe under
   * concurrent imports (ON CONFLICT DO NOTHING + re-read).
   */
  async resolveForImport(
    manager: EntityManager,
    provider: CatalogProvider,
    refs: CatalogGenreRef[],
  ): Promise<Genre[]> {
    if (refs.length === 0) {
      return [];
    }
    const externalIds = [...new Set(refs.map((ref) => ref.externalId))];
    const mappings = manager.getRepository(GenreExternalId);
    const known = new Set(
      (await mappings.findBy({ provider, externalId: In(externalIds) })).map((m) => m.externalId),
    );

    for (const ref of refs.filter((r) => !known.has(r.externalId))) {
      const slug = `${provider}-${ref.externalId}`;
      await manager
        .createQueryBuilder()
        .insert()
        .into(Genre)
        .values({ slug, name: ref.name.trim() || slug })
        .orIgnore()
        .execute();
      const genre = await manager.getRepository(Genre).findOneByOrFail({ slug });
      await manager
        .createQueryBuilder()
        .insert()
        .into(GenreExternalId)
        .values({ provider, externalId: ref.externalId, genreId: genre.id })
        .orIgnore()
        .execute();
    }

    const rows = await mappings.find({
      where: { provider, externalId: In(externalIds) },
      relations: { genre: true },
    });
    return [...new Map(rows.map((row) => [row.genre.id, row.genre])).values()];
  }
}
