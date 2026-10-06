import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ASSET_STORAGE, type AssetStorage, extensionForContentType } from '../assets/asset-storage';
import { isUniqueViolation } from '../database/postgres-errors';
import { Game } from '../games/game.entity';
import { GenresService } from '../genres/genres.service';
import { PlatformsService, resolvePlatforms } from '../platforms/platforms.service';
import type { CatalogProvider } from './catalog-provider';
import { GAME_CATALOG_PROVIDER, type GameCatalogProvider } from './game-catalog-provider';

/** The game doesn't exist in the catalog or its type can't be imported (decision #27). */
export class CatalogGameNotFoundError extends Error {
  constructor() {
    super('Catalog game not found or not importable');
    this.name = 'CatalogGameNotFoundError';
  }
}

/**
 * Imports a catalog game into our database (with platforms, genres and cover)
 * so it keeps working when the provider is down. Called when a game is added
 * to a library (decision #14); already imported games are returned as they are
 * (no automatic sync in V1).
 */
@Injectable()
export class CatalogImportService {
  private readonly logger = new Logger(CatalogImportService.name);

  constructor(
    @Inject(GAME_CATALOG_PROVIDER) private readonly catalog: GameCatalogProvider,
    @Inject(ASSET_STORAGE) private readonly assets: AssetStorage,
    @InjectRepository(Game) private readonly games: Repository<Game>,
    private readonly dataSource: DataSource,
    private readonly platforms: PlatformsService,
    private readonly genres: GenresService,
  ) {}

  /** @throws CatalogGameNotFoundError, CatalogUnavailableError */
  async importGame(provider: CatalogProvider, externalId: string): Promise<Game> {
    if (provider !== this.catalog.id) {
      throw new CatalogGameNotFoundError();
    }
    const existing = await this.findImported(provider, externalId);
    if (existing) {
      return existing;
    }

    const details = await this.catalog.getGame(externalId);
    if (!details) {
      throw new CatalogGameNotFoundError();
    }
    const coverAssetKey = details.coverRef ? await this.storeCover(details.coverRef) : null;
    const platformMap = await this.platforms.mapExternalIds(provider, details.platformExternalIds);

    try {
      await this.dataSource.transaction(async (manager) => {
        const genres = await this.genres.resolveForImport(manager, provider, details.genres);
        const repository = manager.getRepository(Game);
        await repository.save(
          repository.create({
            provider,
            externalId,
            createdByUserId: null,
            name: details.name,
            slug: details.slug,
            summary: details.summary,
            releaseDate: details.releaseDate,
            developers: details.developers,
            publishers: details.publishers,
            coverAssetKey,
            platforms: resolvePlatforms(details.platformExternalIds, platformMap),
            genres,
          }),
        );
      });
    } catch (error) {
      // A concurrent import of the same game won the race: use that one.
      if (!isUniqueViolation(error)) {
        throw error;
      }
    }

    const imported = await this.findImported(provider, externalId);
    if (!imported) {
      throw new Error(`Imported game ${provider}:${externalId} could not be read back`);
    }
    return imported;
  }

  /**
   * Downloads and stores the cover. Failures don't block the import: the game
   * is saved without cover. Keys are content-addressed (identical images share a
   * file), so stored files are never deleted on a failed import.
   */
  private async storeCover(ref: string): Promise<string | null> {
    try {
      const image = await this.catalog.fetchImage(ref, 'cover');
      const extension = extensionForContentType(image.contentType);
      if (!extension) {
        this.logger.warn(`Cover ${ref} has unsupported type ${image.contentType}`);
        return null;
      }
      const hash = createHash('sha256').update(image.data).digest('hex');
      const key = `covers/${hash}.${extension}`;
      await this.assets.put(key, image.data, image.contentType);
      return key;
    } catch (error) {
      this.logger.warn(`Cover ${ref} could not be stored: ${(error as Error).message}`);
      return null;
    }
  }

  private findImported(provider: CatalogProvider, externalId: string): Promise<Game | null> {
    return this.games.findOne({
      where: { provider, externalId },
      relations: { platforms: true, genres: true },
    });
  }
}
