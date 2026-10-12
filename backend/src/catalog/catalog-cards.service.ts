import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { Platform } from '../platforms/platform.entity';
import { type PlatformResponseDto, toPlatformResponse } from '../platforms/platforms.controller';
import { PlatformsService, resolvePlatforms } from '../platforms/platforms.service';
import type { CatalogProvider } from './catalog-provider';
import { catalogArtworkUrl, catalogCoverUrl } from './catalog-urls';
import {
  type CatalogHighlight,
  GAME_CATALOG_PROVIDER,
  type GameCatalogProvider,
} from './game-catalog-provider';

/**
 * A catalog game as a card (Discover, releases, recommendations): enough to show
 * it, open its catalog page and add it to the library, plus where the current
 * user already has it (decision #64).
 */
export interface CatalogCardDto {
  provider: CatalogProvider;
  externalId: string;
  name: string;
  releaseDate: string | null;
  coverUrl: string | null;
  artworkUrl: string | null;
  /** Only platforms we know: the only ones the game can be added on. */
  platforms: PlatformResponseDto[];
  /** Platforms on which the current user already has the game (empty when anonymous). */
  libraryPlatformIds: string[];
  /** The current user's wishlist entry of the game, if any. */
  wishlistItemId: string | null;
}

export interface UserPresence {
  libraryPlatformIds: string[];
  wishlistItemId: string | null;
}

const ABSENT: UserPresence = { libraryPlatformIds: [], wishlistItemId: null };

/** Turns provider games into cards, resolving platforms and the user's presence. */
@Injectable()
export class CatalogCardsService {
  constructor(
    @Inject(GAME_CATALOG_PROVIDER) private readonly catalog: GameCatalogProvider,
    private readonly dataSource: DataSource,
    private readonly platforms: PlatformsService,
  ) {}

  async toCards<T extends CatalogHighlight>(
    games: T[],
    userId: string | null,
    extraPlatformIds: (game: T) => string[] = () => [],
  ): Promise<{ cards: CatalogCardDto[]; platformMap: Map<string, Platform> }> {
    const provider = this.catalog.id;
    const [platformMap, presence] = await Promise.all([
      this.platforms.mapExternalIds(
        provider,
        games.flatMap((game) => [...game.platformExternalIds, ...extraPlatformIds(game)]),
      ),
      this.presence(
        userId,
        games.map((game) => game.externalId),
      ),
    ]);
    const cards = games.map((game) => ({
      provider,
      externalId: game.externalId,
      name: game.name,
      releaseDate: game.releaseDate,
      coverUrl: game.coverRef ? catalogCoverUrl(provider, game.coverRef) : null,
      artworkUrl: game.artworkRef ? catalogArtworkUrl(provider, game.artworkRef) : null,
      platforms: resolvePlatforms(game.platformExternalIds, platformMap).map(toPlatformResponse),
      ...(presence.get(game.externalId) ?? ABSENT),
    }));
    return { cards, platformMap };
  }

  /**
   * Where the user already has each game (library platforms, wishlist entry).
   * Only the user's own rows are read: data stays isolated between users.
   */
  async presence(userId: string | null, externalIds: string[]): Promise<Map<string, UserPresence>> {
    const result = new Map<string, UserPresence>();
    if (!userId || externalIds.length === 0) {
      return result;
    }
    const provider = this.catalog.id;
    const ids = [...new Set(externalIds)];
    const [library, wishlist] = await Promise.all([
      this.dataSource.query<{ external_id: string; platform_ids: string[] }[]>(
        `SELECT g.external_id, array_agg(ug.platform_id::text ORDER BY ug.platform_id) AS platform_ids
         FROM user_games ug JOIN games g ON g.id = ug.game_id
         WHERE ug.user_id = $1 AND g.provider = $2 AND g.external_id = ANY($3)
         GROUP BY g.external_id`,
        [userId, provider, ids],
      ),
      this.dataSource.query<{ external_id: string; id: string }[]>(
        `SELECT g.external_id, w.id
         FROM wishlist_items w JOIN games g ON g.id = w.game_id
         WHERE w.user_id = $1 AND g.provider = $2 AND g.external_id = ANY($3)`,
        [userId, provider, ids],
      ),
    ]);
    const entry = (externalId: string) => {
      let value = result.get(externalId);
      if (!value) {
        value = { libraryPlatformIds: [], wishlistItemId: null };
        result.set(externalId, value);
      }
      return value;
    };
    for (const row of library) {
      entry(row.external_id).libraryPlatformIds = row.platform_ids;
    }
    for (const row of wishlist) {
      entry(row.external_id).wishlistItemId = row.id;
    }
    return result;
  }
}
