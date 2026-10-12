import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, In, IsNull, Repository } from 'typeorm';
import { escapeLikePattern } from '../database/postgres-errors';
import { Game } from '../games/game.entity';
import { type PlatformResponseDto, toPlatformResponse } from '../platforms/platforms.controller';
import { PlatformsService, resolvePlatforms } from '../platforms/platforms.service';
import type { CatalogProvider } from './catalog-provider';
import { assetUrl, catalogThumbnailUrl } from './catalog-urls';
import {
  type CatalogGameSummary,
  CatalogUnavailableError,
  GAME_CATALOG_PROVIDER,
  type GameCatalogProvider,
} from './game-catalog-provider';
import { TtlCache } from './ttl-cache';

export const SEARCH_RESULT_LIMIT = 20;
const SEARCH_CACHE_TTL_MS = 10 * 60 * 1000;
const SEARCH_CACHE_MAX_ENTRIES = 500;

export interface CatalogSearchResultDto {
  /** Set when the game already exists in our database (imported or manual). */
  gameId: string | null;
  provider: CatalogProvider | null;
  externalId: string | null;
  name: string;
  releaseDate: string | null;
  coverUrl: string | null;
  /** Only platforms we know; the user can only pick among these (decision #22). */
  platforms: PlatformResponseDto[];
  isManual: boolean;
}

export interface CatalogSearchResponseDto {
  results: CatalogSearchResultDto[];
  /** False when the external catalog failed and only local results are shown. */
  catalogAvailable: boolean;
}

/** Search combining the external catalog with local games (decision #28). */
@Injectable()
export class CatalogSearchService {
  private readonly logger = new Logger(CatalogSearchService.name);
  private readonly cache = new TtlCache<CatalogGameSummary[]>(
    SEARCH_CACHE_TTL_MS,
    SEARCH_CACHE_MAX_ENTRIES,
  );

  constructor(
    @Inject(GAME_CATALOG_PROVIDER) private readonly catalog: GameCatalogProvider,
    @InjectRepository(Game) private readonly games: Repository<Game>,
    private readonly platforms: PlatformsService,
  ) {}

  /** For tests and future admin tooling. */
  clearCache(): void {
    this.cache.clear();
  }

  async search(rawQuery: string, userId: string | null): Promise<CatalogSearchResponseDto> {
    const query = rawQuery.trim().replace(/\s+/g, ' ');
    const [remote, local] = await Promise.all([
      this.searchProvider(query),
      this.searchLocal(query, userId),
    ]);

    const results: CatalogSearchResultDto[] = [];
    const seenGameIds = new Set<string>();

    if (remote) {
      const imported = await this.findImported(remote.map((r) => r.externalId));
      const platformMap = await this.platforms.mapExternalIds(
        this.catalog.id,
        remote.flatMap((r) => r.platformExternalIds),
      );
      for (const summary of remote) {
        const game = imported.get(summary.externalId);
        if (game) {
          seenGameIds.add(game.id);
          results.push(fromGame(game));
        } else {
          results.push(
            this.fromSummary(summary, resolvePlatforms(summary.platformExternalIds, platformMap)),
          );
        }
      }
    }

    for (const game of local) {
      if (!seenGameIds.has(game.id)) {
        results.push(fromGame(game));
      }
    }

    return { results, catalogAvailable: remote !== null };
  }

  private async searchProvider(query: string): Promise<CatalogGameSummary[] | null> {
    const cacheKey = `${this.catalog.id}:${query.toLowerCase()}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }
    try {
      const results = await this.catalog.searchGames(query, SEARCH_RESULT_LIMIT);
      this.cache.set(cacheKey, results);
      return results;
    } catch (error) {
      if (!(error instanceof CatalogUnavailableError)) {
        this.logger.error('Unexpected catalog search failure', error);
      } else {
        this.logger.warn(`Catalog search unavailable: ${error.message}`);
      }
      return null;
    }
  }

  /** Imported catalog games plus the user's own manual games (none when anonymous). */
  private searchLocal(query: string, userId: string | null): Promise<Game[]> {
    const name = ILike(`%${escapeLikePattern(query)}%`);
    return this.games.find({
      where: [
        { name, createdByUserId: IsNull() },
        ...(userId ? [{ name, createdByUserId: userId }] : []),
      ],
      relations: { platforms: true },
      order: { name: 'ASC' },
      take: SEARCH_RESULT_LIMIT,
    });
  }

  private async findImported(externalIds: string[]): Promise<Map<string, Game>> {
    if (externalIds.length === 0) {
      return new Map();
    }
    const games = await this.games.find({
      where: { provider: this.catalog.id, externalId: In(externalIds) },
      relations: { platforms: true },
    });
    return new Map(games.map((game) => [game.externalId ?? '', game]));
  }

  private fromSummary(
    summary: CatalogGameSummary,
    platforms: ReturnType<typeof resolvePlatforms>,
  ): CatalogSearchResultDto {
    return {
      gameId: null,
      provider: this.catalog.id,
      externalId: summary.externalId,
      name: summary.name,
      releaseDate: summary.releaseDate,
      coverUrl: summary.coverRef ? catalogThumbnailUrl(this.catalog.id, summary.coverRef) : null,
      platforms: platforms.map(toPlatformResponse),
      isManual: false,
    };
  }
}

function fromGame(game: Game): CatalogSearchResultDto {
  return {
    gameId: game.id,
    provider: game.provider,
    externalId: game.externalId,
    name: game.name,
    releaseDate: game.releaseDate,
    coverUrl: game.coverAssetKey ? assetUrl(game.coverAssetKey) : null,
    platforms: [...game.platforms]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(toPlatformResponse),
    isManual: game.createdByUserId !== null,
  };
}
