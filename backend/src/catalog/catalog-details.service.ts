import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { apiError } from '../common/api-error';
import { Game } from '../games/game.entity';
import { GenresService } from '../genres/genres.service';
import { PlayStatus } from '../library/library.constants';
import { UserGameSummary } from '../library/library-views.entity';
import { UserGame } from '../library/user-game.entity';
import { WishlistItem } from '../wishlist/wishlist-item.entity';
import { type PlatformResponseDto, toPlatformResponse } from '../platforms/platforms.controller';
import { PlatformsService, resolvePlatforms } from '../platforms/platforms.service';
import { assetUrl, catalogArtworkUrl, catalogCoverUrl, catalogScreenshotUrl } from './catalog-urls';
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
  /** Wide high-resolution image (artwork or screenshot) for the page header, if any. */
  artworkUrl: string | null;
  /** Only platforms we know: the only ones the game can be added on. */
  platforms: PlatformResponseDto[];
  /** `id`/`slug` are null for provider genres we don't know yet. */
  genres: { id: string | null; slug: string | null; name: string }[];
  developers: string[];
  publishers: string[];
  /** In-game screenshots: a gallery size and a full size each. */
  screenshots: { thumbnailUrl: string; fullUrl: string }[];
  /** Similar games according to the provider, each with its own catalog page. */
  relatedGames: RelatedGameDto[];
  /** The current user's UserGames of this game (one per platform), with their progress. */
  libraryEntries: LibraryEntryDto[];
  /** The current user's wishlist entry of this game, if any (decision #66). */
  wishlistItemId: string | null;
}

export interface RelatedGameDto {
  provider: string;
  externalId: string;
  name: string;
  releaseDate: string | null;
  coverUrl: string | null;
}

export interface LibraryEntryDto {
  userGameId: string;
  platform: PlatformResponseDto;
  status: PlayStatus;
  totalMinutes: number;
  rating: number | null;
  platinumAchieved: boolean;
}

/** What only the provider knows (not stored on import): decorative, may be empty. */
type ProviderExtras = Pick<CatalogGameDto, 'artworkUrl' | 'screenshots' | 'relatedGames'>;

const NO_EXTRAS: ProviderExtras = { artworkUrl: null, screenshots: [], relatedGames: [] };

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

  async get(userId: string | null, provider: string, externalId: string): Promise<CatalogGameDto> {
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
        ...(await this.extrasOfImported(externalId)),
        platforms: [...local.platforms]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map(toPlatformResponse),
        genres: [...local.genres]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((g) => ({ id: g.id, slug: g.slug, name: g.name })),
        developers: local.developers,
        publishers: local.publishers,
        libraryEntries: await this.libraryEntries(userId, local.id),
        wishlistItemId: await this.wishlistItemId(userId, local.id),
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
      ...this.extras(details),
      platforms: resolvePlatforms(details.platformExternalIds, platformMap).map(toPlatformResponse),
      genres: await this.genres.describe(this.catalog.id, details.genres),
      developers: details.developers,
      publishers: details.publishers,
      libraryEntries: [],
      // Wishlisted games are always imported: a game that isn't can't be wishlisted.
      wishlistItemId: null,
    };
  }

  /**
   * Name of a catalog game (stored or from the provider, cached), e.g. to find
   * it in the price source. Throws 404/503 like `get`.
   */
  async nameOf(provider: string, externalId: string): Promise<string> {
    if (provider !== String(this.catalog.id)) {
      throw catalogGameNotFound();
    }
    const local = await this.games.findOne({
      where: { provider: this.catalog.id, externalId },
      select: { id: true, name: true },
    });
    return local?.name ?? (await this.fetchDetails(externalId)).name;
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

  private extras(details: CatalogGameDetails): ProviderExtras {
    const provider = this.catalog.id;
    return {
      artworkUrl: details.artworkRef ? catalogArtworkUrl(provider, details.artworkRef) : null,
      screenshots: details.screenshotRefs.map((ref) => ({
        thumbnailUrl: catalogScreenshotUrl(provider, ref),
        fullUrl: catalogArtworkUrl(provider, ref),
      })),
      relatedGames: details.similarGames.map((game) => ({
        provider,
        externalId: game.externalId,
        name: game.name,
        releaseDate: game.releaseDate,
        coverUrl: game.coverRef ? catalogCoverUrl(provider, game.coverRef) : null,
      })),
    };
  }

  /**
   * Artwork, screenshots and similar games aren't stored on import: they're taken
   * from the provider (cached). Purely decorative, so any failure just leaves them
   * empty and the page still works.
   */
  private async extrasOfImported(externalId: string): Promise<ProviderExtras> {
    try {
      return this.extras(await this.fetchDetails(externalId));
    } catch {
      return NO_EXTRAS;
    }
  }

  private async wishlistItemId(userId: string | null, gameId: string): Promise<string | null> {
    if (!userId) {
      return null;
    }
    const item = await this.dataSource
      .getRepository(WishlistItem)
      .findOne({ where: { userId, gameId }, select: { id: true } });
    return item?.id ?? null;
  }

  private async libraryEntries(userId: string | null, gameId: string): Promise<LibraryEntryDto[]> {
    if (!userId) {
      return [];
    }
    const userGames = await this.dataSource.getRepository(UserGame).find({
      where: { userId, gameId },
      relations: { platform: true },
    });
    if (userGames.length === 0) {
      return [];
    }
    const summaries = await this.dataSource
      .getRepository(UserGameSummary)
      .findBy({ userGameId: In(userGames.map((ug) => ug.id)) });
    const summaryOf = new Map(summaries.map((summary) => [summary.userGameId, summary]));
    return userGames
      .sort((a, b) => a.platform.sortOrder - b.platform.sortOrder)
      .map((ug) => ({
        userGameId: ug.id,
        platform: toPlatformResponse(ug.platform),
        status: summaryOf.get(ug.id)?.status ?? PlayStatus.Pending,
        totalMinutes: summaryOf.get(ug.id)?.totalMinutes ?? 0,
        rating: ug.rating,
        platinumAchieved: ug.platinumAchieved,
      }));
  }
}

function catalogGameNotFound() {
  return apiError(HttpStatus.NOT_FOUND, 'CATALOG_GAME_NOT_FOUND', 'Catalog game not found');
}
