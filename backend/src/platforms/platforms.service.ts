import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { CatalogProvider } from '../catalog/catalog-provider';
import { PlatformExternalId } from './platform-external-id.entity';
import { Platform } from './platform.entity';

@Injectable()
export class PlatformsService {
  constructor(
    @InjectRepository(Platform) private readonly platforms: Repository<Platform>,
    @InjectRepository(PlatformExternalId)
    private readonly externalIds: Repository<PlatformExternalId>,
  ) {}

  findAll(): Promise<Platform[]> {
    return this.platforms.find({ order: { sortOrder: 'ASC' } });
  }

  /**
   * Maps provider platform ids to our platforms. Ids without a mapping are
   * absent from the result: those platforms can't be chosen (decision #22).
   */
  async mapExternalIds(
    provider: CatalogProvider,
    externalIds: string[],
  ): Promise<Map<string, Platform>> {
    if (externalIds.length === 0) {
      return new Map();
    }
    const rows = await this.externalIds.find({
      where: { provider, externalId: In([...new Set(externalIds)]) },
      relations: { platform: true },
    });
    return new Map(rows.map((row) => [row.externalId, row.platform]));
  }

  /** Provider ids of one of our platforms (e.g. PC → Windows, Mac, Linux), [] if unknown. */
  async externalIdsForSlug(provider: CatalogProvider, slug: string): Promise<string[]> {
    const rows = await this.externalIds.find({
      where: { provider, platform: { slug } },
      relations: { platform: true },
    });
    return rows.map((row) => row.externalId);
  }
}

/** Distinct platforms for a list of external ids, in display order. */
export function resolvePlatforms(
  externalIds: string[],
  mapping: Map<string, Platform>,
): Platform[] {
  const platforms = new Map<string, Platform>();
  for (const externalId of externalIds) {
    const platform = mapping.get(externalId);
    if (platform) {
      // Several external ids can map to one platform (Windows/Mac/Linux → PC).
      platforms.set(platform.id, platform);
    }
  }
  return [...platforms.values()].sort((a, b) => a.sortOrder - b.sortOrder);
}
