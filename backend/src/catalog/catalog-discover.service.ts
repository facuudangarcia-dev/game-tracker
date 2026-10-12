import { Inject, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { type GenreResponseDto, toGenreResponse } from '../genres/genres.controller';
import { GenresService } from '../genres/genres.service';
import { PlatformsService } from '../platforms/platforms.service';
import { type CatalogCardDto, CatalogCardsService } from './catalog-cards.service';
import {
  type CatalogDiscoverSort,
  type CatalogHighlight,
  type CatalogReleaseFilter,
  CatalogUnavailableError,
  GAME_CATALOG_PROVIDER,
  type GameCatalogProvider,
} from './game-catalog-provider';
import { TtlCache } from './ttl-cache';

export const DISCOVER_PAGE_SIZE = 24;
export const DISCOVER_MAX_PAGE = 20;
export const RECOMMENDATIONS_LIMIT = 18;
/** Below this many catalog games in the library, recommendations are general. */
export const RECOMMENDATIONS_MIN_LIBRARY = 3;
/** "Recent" in the release filter: released in the last 90 days. */
const RECENT_DAYS = 90;
/** "General" discovery: popular games of the last two years. */
const GENERAL_YEARS = 2;
const MAX_SEED_GAMES = 5;
const MAX_TASTE_GENRES = 3;
const CACHE_TTL_MS = 30 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** `upcoming`, `recent` (last 90 days) or a year. */
export type ReleaseFilter = 'upcoming' | 'recent' | `${number}`;

export interface DiscoverQuery {
  platform?: string;
  genre?: string;
  release?: ReleaseFilter;
  sort?: CatalogDiscoverSort;
  page?: number;
}

export interface DiscoverResponseDto {
  games: CatalogCardDto[];
  page: number;
  hasMore: boolean;
  /** False when the external catalog failed: the list is empty. */
  catalogAvailable: boolean;
}

export interface RecommendationsResponseDto {
  /** True when based on the user's own games (favorites, ratings and genres). */
  personalized: boolean;
  /** The user's favorite genres used, most relevant first (personalized only). */
  basedOnGenres: GenreResponseDto[];
  games: CatalogCardDto[];
  catalogAvailable: boolean;
}

interface TasteRow {
  external_id: string;
  rating: number | null;
  favorite: boolean;
  genre_external_ids: string[] | null;
}

/**
 * Discover (decision #64): a filterable view of the external catalog and
 * recommendations. Read only: nothing is imported; cards link to the existing
 * catalog page.
 */
@Injectable()
export class CatalogDiscoverService {
  private readonly logger = new Logger(CatalogDiscoverService.name);
  private readonly cache = new TtlCache<CatalogHighlight[]>(CACHE_TTL_MS, 300);

  constructor(
    @Inject(GAME_CATALOG_PROVIDER) private readonly catalog: GameCatalogProvider,
    private readonly dataSource: DataSource,
    private readonly platforms: PlatformsService,
    private readonly genres: GenresService,
    private readonly cards: CatalogCardsService,
  ) {}

  /** For tests. */
  clearCache(): void {
    this.cache.clear();
  }

  async discover(
    query: DiscoverQuery,
    userId: string | null,
    now = new Date(),
  ): Promise<DiscoverResponseDto> {
    const page = query.page ?? 1;
    const filter = await this.resolveFilter(query.platform, query.genre);
    if (!filter) {
      return { games: [], page, hasMore: false, catalogAvailable: true };
    }
    const { from, to } = releaseRange(query.release, now);
    const sort = query.sort ?? (query.release === 'upcoming' ? 'anticipated' : 'popular');
    const key = JSON.stringify(['discover', filter, from, to, sort, page]);
    const games = await this.cached(key, () =>
      this.catalog.discoverGames({
        ...filter,
        releasedFrom: from,
        releasedTo: to,
        sort,
        excludeExternalIds: [],
        // One more than shown, to know whether there's a next page.
        limit: DISCOVER_PAGE_SIZE + 1,
        offset: (page - 1) * DISCOVER_PAGE_SIZE,
      }),
    );
    if (!games) {
      return { games: [], page, hasMore: false, catalogAvailable: false };
    }
    const { cards } = await this.cards.toCards(games.slice(0, DISCOVER_PAGE_SIZE), userId);
    return {
      games: cards,
      page,
      hasMore: games.length > DISCOVER_PAGE_SIZE && page < DISCOVER_MAX_PAGE,
      catalogAvailable: true,
    };
  }

  /**
   * With enough games in the library, games similar to the user's favorites and
   * best rated ones, then top-rated games of their favorite genres; never games
   * they already have. Otherwise (or anonymous), popular recent games.
   */
  async recommendations(
    userId: string | null,
    now = new Date(),
  ): Promise<RecommendationsResponseDto> {
    const taste = userId ? await this.taste(userId) : null;
    const owned = taste?.owned ?? new Set<string>();

    if (taste && taste.owned.size >= RECOMMENDATIONS_MIN_LIBRARY) {
      // Cached per taste, not per library: owned games are filtered out afterwards.
      const excluded = [...owned];
      const [similar, byGenre] = await Promise.all([
        this.cached(JSON.stringify(['similar', taste.seeds]), () =>
          this.catalog.listSimilarGames(taste.seeds, excluded, RECOMMENDATIONS_LIMIT * 2),
        ),
        taste.genres.length > 0
          ? this.cached(JSON.stringify(['taste', taste.genres]), () =>
              this.catalog.discoverGames({
                platformExternalIds: [],
                genreExternalIds: taste.genres,
                releasedFrom: null,
                releasedTo: null,
                sort: 'top-rated',
                excludeExternalIds: excluded,
                limit: RECOMMENDATIONS_LIMIT * 2,
                offset: 0,
              }),
            )
          : Promise.resolve([]),
      ]);
      const basedOnGenres = (
        await this.genres.findByExternalIds(this.catalog.id, taste.genres)
      ).map(toGenreResponse);
      if (!similar || !byGenre) {
        return { personalized: true, basedOnGenres, games: [], catalogAvailable: false };
      }
      return this.recommendationResponse(
        [...similar, ...byGenre],
        owned,
        userId,
        true,
        basedOnGenres,
      );
    }

    const from = new Date(now.getTime());
    from.setUTCFullYear(from.getUTCFullYear() - GENERAL_YEARS);
    const fromDay = isoDay(from);
    const games = await this.cached(JSON.stringify(['general', fromDay]), () =>
      this.catalog.discoverGames({
        platformExternalIds: [],
        genreExternalIds: [],
        releasedFrom: fromDay,
        releasedTo: isoDay(now),
        sort: 'popular',
        excludeExternalIds: [],
        limit: RECOMMENDATIONS_LIMIT * 2,
        offset: 0,
      }),
    );
    if (!games) {
      return { personalized: false, basedOnGenres: [], games: [], catalogAvailable: false };
    }
    return this.recommendationResponse(games, owned, userId, false, []);
  }

  /**
   * Our platform/genre slugs as provider ids. Null when a slug is unknown or has
   * no provider mapping: nothing can match it.
   */
  async resolveFilter(platform?: string, genre?: string): Promise<CatalogReleaseFilter | null> {
    const [platformExternalIds, genreExternalIds] = await Promise.all([
      platform ? this.platforms.externalIdsForSlug(this.catalog.id, platform) : [],
      genre ? this.genres.externalIdsForSlug(this.catalog.id, genre) : [],
    ]);
    if (
      (platform && platformExternalIds.length === 0) ||
      (genre && genreExternalIds.length === 0)
    ) {
      return null;
    }
    return { platformExternalIds, genreExternalIds };
  }

  private async recommendationResponse(
    games: CatalogHighlight[],
    owned: Set<string>,
    userId: string | null,
    personalized: boolean,
    basedOnGenres: GenreResponseDto[],
  ): Promise<RecommendationsResponseDto> {
    const unique = new Map<string, CatalogHighlight>();
    for (const game of games) {
      if (!owned.has(game.externalId) && !unique.has(game.externalId)) {
        unique.set(game.externalId, game);
      }
    }
    const { cards } = await this.cards.toCards(
      [...unique.values()].slice(0, RECOMMENDATIONS_LIMIT),
      userId,
    );
    return { personalized, basedOnGenres, games: cards, catalogAvailable: true };
  }

  /**
   * The user's taste from their catalog games: seeds (favorites first, then the
   * best rated) and genres weighted by favorites and ratings. Only their rows.
   */
  private async taste(
    userId: string,
  ): Promise<{ owned: Set<string>; seeds: string[]; genres: string[] }> {
    const rows = await this.dataSource.query<TasteRow[]>(
      `SELECT g.external_id,
              MAX(ug.rating)::int AS rating,
              bool_or(ug.favorite_at IS NOT NULL) AS favorite,
              (SELECT array_agg(gei.external_id)
                 FROM game_genres gg
                 JOIN genre_external_ids gei ON gei.genre_id = gg.genre_id AND gei.provider = g.provider
                WHERE gg.game_id = g.id) AS genre_external_ids
         FROM user_games ug JOIN games g ON g.id = ug.game_id
        WHERE ug.user_id = $1 AND g.provider = $2
        GROUP BY g.id`,
      [userId, this.catalog.id],
    );
    const weight = (row: TasteRow) =>
      (row.favorite ? 3 : 0) +
      (row.rating === null
        ? 0.5
        : row.rating >= 80
          ? 2
          : row.rating >= 60
            ? 1
            : row.rating < 50
              ? -1
              : 0);

    const seeds = rows
      .filter((row) => row.favorite || (row.rating ?? 0) >= 80)
      .sort((a, b) => weight(b) - weight(a) || (b.rating ?? 0) - (a.rating ?? 0))
      .slice(0, MAX_SEED_GAMES)
      .map((row) => row.external_id);

    const scores = new Map<string, number>();
    for (const row of rows) {
      for (const genre of row.genre_external_ids ?? []) {
        scores.set(genre, (scores.get(genre) ?? 0) + weight(row));
      }
    }
    const genres = [...scores.entries()]
      .filter(([, score]) => score > 0)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, MAX_TASTE_GENRES)
      .map(([genre]) => genre);

    return { owned: new Set(rows.map((row) => row.external_id)), seeds, genres };
  }

  /** Cached provider list; null when the provider failed (not cached). */
  private async cached(
    key: string,
    load: () => Promise<CatalogHighlight[]>,
  ): Promise<CatalogHighlight[] | null> {
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }
    try {
      const games = await load();
      this.cache.set(key, games);
      return games;
    } catch (error) {
      if (error instanceof CatalogUnavailableError) {
        this.logger.warn(`Catalog discovery unavailable: ${error.message}`);
      } else {
        this.logger.error('Unexpected catalog discovery failure', error);
      }
      return null;
    }
  }
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Release date range (inclusive, YYYY-MM-DD) of a release filter. */
export function releaseRange(
  release: ReleaseFilter | undefined,
  now: Date,
): { from: string | null; to: string | null } {
  if (release === 'upcoming') {
    return { from: isoDay(new Date(now.getTime() + DAY_MS)), to: null };
  }
  if (release === 'recent') {
    return { from: isoDay(new Date(now.getTime() - RECENT_DAYS * DAY_MS)), to: isoDay(now) };
  }
  if (release) {
    return { from: `${release}-01-01`, to: `${release}-12-31` };
  }
  return { from: null, to: null };
}
