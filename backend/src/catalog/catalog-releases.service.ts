import { Inject, Injectable, Logger } from '@nestjs/common';
import { type PlatformResponseDto, toPlatformResponse } from '../platforms/platforms.controller';
import { resolvePlatforms } from '../platforms/platforms.service';
import { type CatalogCardDto, CatalogCardsService } from './catalog-cards.service';
import { CatalogDiscoverService } from './catalog-discover.service';
import {
  type CatalogHighlight,
  type CatalogRelease,
  CatalogUnavailableError,
  GAME_CATALOG_PROVIDER,
  type GameCatalogProvider,
  type ReleaseDatePrecision,
} from './game-catalog-provider';
import { TtlCache } from './ttl-cache';

/** Longest range of one request: "next months" covers three months. */
export const RELEASES_MAX_RANGE_DAYS = 93;
export const UNDATED_LIMIT = 24;
/** Release dates change slowly: one provider query per range and hour at most. */
const CACHE_TTL_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ReleaseDto extends CatalogCardDto {
  /** YYYY-MM-DD. Estimated dates (precision other than `day`) are a day inside the period. */
  date: string;
  /** `day` = confirmed date; `month`, `quarter` and `year` = estimated by the source. */
  precision: ReleaseDatePrecision;
  /** Platforms released on that date (our platforms only). */
  releasePlatforms: PlatformResponseDto[];
}

export interface ReleasesResponseDto {
  releases: ReleaseDto[];
  catalogAvailable: boolean;
}

export interface UndatedResponseDto {
  games: CatalogCardDto[];
  catalogAvailable: boolean;
}

export interface ReleasesQuery {
  from: string;
  to: string;
  platform?: string;
  genre?: string;
}

/** Releases calendar (decision #65), read only from the external catalog. */
@Injectable()
export class CatalogReleasesService {
  private readonly logger = new Logger(CatalogReleasesService.name);
  private readonly releasesCache = new TtlCache<CatalogRelease[]>(CACHE_TTL_MS, 100);
  private readonly undatedCache = new TtlCache<CatalogHighlight[]>(CACHE_TTL_MS, 50);

  constructor(
    @Inject(GAME_CATALOG_PROVIDER) private readonly catalog: GameCatalogProvider,
    private readonly discover: CatalogDiscoverService,
    private readonly cards: CatalogCardsService,
  ) {}

  /** For tests. */
  clearCache(): void {
    this.releasesCache.clear();
    this.undatedCache.clear();
  }

  async releases(query: ReleasesQuery, userId: string | null): Promise<ReleasesResponseDto> {
    const filter = await this.discover.resolveFilter(query.platform, query.genre);
    if (!filter) {
      return { releases: [], catalogAvailable: true };
    }
    const key = JSON.stringify([query.from, query.to, filter]);
    let cached = this.releasesCache.get(key);
    if (!cached) {
      try {
        cached = await this.catalog.listReleases(query.from, query.to, filter);
        this.releasesCache.set(key, cached);
      } catch (error) {
        this.logFailure(error);
        return { releases: [], catalogAvailable: false };
      }
    }
    const releases = cached;
    const { cards, platformMap } = await this.cards.toCards(
      releases,
      userId,
      (release) => release.releasePlatformExternalIds,
    );
    return {
      releases: cards.map((card, index) => ({
        ...card,
        date: releases[index].date,
        precision: releases[index].precision,
        releasePlatforms: resolvePlatforms(
          releases[index].releasePlatformExternalIds,
          platformMap,
        ).map(toPlatformResponse),
      })),
      catalogAvailable: true,
    };
  }

  async undated(
    query: Pick<ReleasesQuery, 'platform' | 'genre'>,
    userId: string | null,
  ): Promise<UndatedResponseDto> {
    const filter = await this.discover.resolveFilter(query.platform, query.genre);
    if (!filter) {
      return { games: [], catalogAvailable: true };
    }
    const key = JSON.stringify(filter);
    let games = this.undatedCache.get(key);
    if (!games) {
      try {
        games = await this.catalog.listUndatedGames(filter, UNDATED_LIMIT);
        this.undatedCache.set(key, games);
      } catch (error) {
        this.logFailure(error);
        return { games: [], catalogAvailable: false };
      }
    }
    return { games: (await this.cards.toCards(games, userId)).cards, catalogAvailable: true };
  }

  private logFailure(error: unknown): void {
    if (error instanceof CatalogUnavailableError) {
      this.logger.warn(`Catalog releases unavailable: ${error.message}`);
    } else {
      this.logger.error('Unexpected catalog releases failure', error);
    }
  }
}

/** Whole days between two YYYY-MM-DD dates (to - from). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}
