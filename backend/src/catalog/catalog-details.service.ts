import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { apiError } from '../common/api-error';
import { Game } from '../games/game.entity';
import { GenresService } from '../genres/genres.service';
import { UserGame } from '../library/user-game.entity';
import { type PlatformResponseDto, toPlatformResponse } from '../platforms/platforms.controller';
import { PlatformsService, resolvePlatforms } from '../platforms/platforms.service';
import { assetUrl, catalogCoverUrl } from './catalog-urls';
import {
  type CatalogGameDetails,
  CatalogUnavailableError,
  GAME_CATALOG_PROVIDER,
  type GameCatalogProvider,
} from './game-catalog-provider';
import { TtlCache } from './ttl-cache';

const DETAILS_CACHE_TTL_MS = 10 * 60 * 1000;
const DETAILS_CACHE_MAX_ENTRIES = 200;

export interface CatalogGameDto {
  /** Local id when the game was already imported, null otherwise. */
  gameId: string | null;
  provider: string;
  externalId: string;
  name: string;
  summary: string | null;
  releaseDate: string | null;
  coverUrl: string | null;
  /** Only platforms we know: the only ones the game can be added on. */
  platforms: PlatformResponseDto[];
  genres: { id: string | null; name: string }[];
  developers: string[];
  publishers: string[];
  /** The current user's UserGames of this game (one per platform). */
  libraryEntries: { userGameId: string; platform: PlatformResponseDto }[];
}

/**
 * Public ("this game exists") view of a catalog game, addressed by provider and
 * external id. Imported games are served from our database (works while the
 * provider is down); others are fetched from the provider WITHOUT being stored
 * (decision #14). Manual games have no external id, so they can never be
 * reached here.
 */
@Injectable()
export class CatalogDetailsService {
  private readonly cache = new TtlCache<CatalogGameDetails>(
    DETAILS_CACHE_TTL_MS,
    DETAILS_CACHE_MAX_ENTRIES,
  );

  constructor(
    @Inject(GAME_CATALOG_PROVIDER) private readonly catalog: GameCatalogProvider,
    @InjectRepository(Game) private readonly games: Repository<Game>,
    private readonly dataSource: DataSource,
    private readonly platforms: PlatformsService,
    private readonly genres: GenresService,
  ) {}

  async get(userId: string, provider: string, externalId: string): Promise<CatalogGameDto> {
    if (provider !== String(this.catalog.id)) {
      throw catalogGameNotFound();
    }

    const local = await this.games.findOne({
      where: { provider: this.catalog.id, externalId },
      relations: { platforms: true, genres: true },
    });
    if (local) {
      return {
        gameId: local.id,
        provider,
        externalId,
        name: local.name,
        summary: local.summary,
        releaseDate: local.releaseDate,
        coverUrl: local.coverAssetKey ? assetUrl(local.coverAssetKey) : null,
        platforms: [...local.platforms]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map(toPlatformResponse),
        genres: [...local.genres]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((g) => ({ id: g.id, name: g.name })),
        developers: local.developers,
        publishers: local.publishers,
        libraryEntries: await this.libraryEntries(userId, local.id),
      };
    }

    const details = await this.fetchDetails(externalId);
    const platformMap = await this.platforms.mapExternalIds(
      this.catalog.id,
      details.platformExternalIds,
    );
    return {
      gameId: null,
      provider,
      externalId,
      name: details.name,
      summary: details.summary,
      releaseDate: details.releaseDate,
      coverUrl: details.coverRef ? catalogCoverUrl(this.catalog.id, details.coverRef) : null,
      platforms: resolvePlatforms(details.platformExternalIds, platformMap).map(toPlatformResponse),
      genres: await this.genres.describe(this.catalog.id, details.genres),
      developers: details.developers,
      publishers: details.publishers,
      libraryEntries: [],
    };
  }

  /** For tests. */
  clearCache(): void {
    this.cache.clear();
  }

  private async fetchDetails(externalId: string): Promise<CatalogGameDetails> {
    const cacheKey = `${this.catalog.id}:${externalId}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }
    let details: CatalogGameDetails | null;
    try {
      details = await this.catalog.getGame(externalId);
    } catch (error) {
      if (error instanceof CatalogUnavailableError) {
        throw apiError(
          HttpStatus.SERVICE_UNAVAILABLE,
          'CATALOG_UNAVAILABLE',
          'The game catalog is not available right now',
        );
      }
      throw error;
    }
    if (!details) {
      throw catalogGameNotFound();
    }
    this.cache.set(cacheKey, details);
    return details;
  }

  private async libraryEntries(userId: string, gameId: string) {
    const userGames = await this.dataSource.getRepository(UserGame).find({
      where: { userId, gameId },
      relations: { platform: true },
    });
    return userGames
      .sort((a, b) => a.platform.sortOrder - b.platform.sortOrder)
      .map((ug) => ({ userGameId: ug.id, platform: toPlatformResponse(ug.platform) }));
  }
}

function catalogGameNotFound() {
  return apiError(HttpStatus.NOT_FOUND, 'CATALOG_GAME_NOT_FOUND', 'Catalog game not found');
}
