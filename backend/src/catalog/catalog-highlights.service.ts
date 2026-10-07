import { Inject, Injectable, Logger } from '@nestjs/common';
import { type PlatformResponseDto, toPlatformResponse } from '../platforms/platforms.controller';
import { PlatformsService, resolvePlatforms } from '../platforms/platforms.service';
import type { CatalogProvider } from './catalog-provider';
import { catalogArtworkUrl, catalogCoverUrl } from './catalog-urls';
import {
  type CatalogHighlight,
  type CatalogHighlightKind,
  CatalogUnavailableError,
  GAME_CATALOG_PROVIDER,
  type GameCatalogProvider,
} from './game-catalog-provider';
import { TtlCache } from './ttl-cache';

export const HIGHLIGHTS_LIMIT = 12;
/** Highlights change slowly: one provider query per list and hour at most. */
const HIGHLIGHTS_CACHE_TTL_MS = 60 * 60 * 1000;

export interface CatalogHighlightDto {
  provider: CatalogProvider;
  externalId: string;
  name: string;
  releaseDate: string | null;
  coverUrl: string | null;
  /** Wide high-resolution image for hero backgrounds, if any. */
  artworkUrl: string | null;
  platforms: PlatformResponseDto[];
}

export interface CatalogHighlightsDto {
  recent: CatalogHighlightDto[];
  upcoming: CatalogHighlightDto[];
  /** False when the external catalog failed: the lists are empty. */
  catalogAvailable: boolean;
}

/**
 * Recent and upcoming notable games for the Home (docs/decisions.md #53). Read
 * only: nothing is imported or stored; images go through the proxy.
 */
@Injectable()
export class CatalogHighlightsService {
  private readonly logger = new Logger(CatalogHighlightsService.name);
  private readonly cache = new TtlCache<CatalogHighlight[]>(HIGHLIGHTS_CACHE_TTL_MS, 2);

  constructor(
    @Inject(GAME_CATALOG_PROVIDER) private readonly catalog: GameCatalogProvider,
    private readonly platforms: PlatformsService,
  ) {}

  /** For tests and future admin tooling. */
  clearCache(): void {
    this.cache.clear();
  }

  async get(): Promise<CatalogHighlightsDto> {
    const [recent, upcoming] = await Promise.all([this.list('recent'), this.list('upcoming')]);
    if (!recent || !upcoming) {
      return { recent: [], upcoming: [], catalogAvailable: false };
    }

    const platformMap = await this.platforms.mapExternalIds(
      this.catalog.id,
      [...recent, ...upcoming].flatMap((game) => game.platformExternalIds),
    );
    const toDto = (game: CatalogHighlight): CatalogHighlightDto => ({
      provider: this.catalog.id,
      externalId: game.externalId,
      name: game.name,
      releaseDate: game.releaseDate,
      coverUrl: game.coverRef ? catalogCoverUrl(this.catalog.id, game.coverRef) : null,
      artworkUrl: game.artworkRef ? catalogArtworkUrl(this.catalog.id, game.artworkRef) : null,
      platforms: resolvePlatforms(game.platformExternalIds, platformMap).map(toPlatformResponse),
    });
    return { recent: recent.map(toDto), upcoming: upcoming.map(toDto), catalogAvailable: true };
  }

  private async list(kind: CatalogHighlightKind): Promise<CatalogHighlight[] | null> {
    const cached = this.cache.get(kind);
    if (cached) {
      return cached;
    }
    try {
      const games = await this.catalog.listHighlights(kind, HIGHLIGHTS_LIMIT);
      this.cache.set(kind, games);
      return games;
    } catch (error) {
      if (error instanceof CatalogUnavailableError) {
        this.logger.warn(`Catalog highlights unavailable: ${error.message}`);
      } else {
        this.logger.error('Unexpected catalog highlights failure', error);
      }
      return null;
    }
  }
}
