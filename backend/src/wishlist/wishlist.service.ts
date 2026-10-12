import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CatalogGameNotFoundError, CatalogImportService } from '../catalog/catalog-import.service';
import type { CatalogProvider } from '../catalog/catalog-provider';
import { assetUrl } from '../catalog/catalog-urls';
import { CatalogUnavailableError } from '../catalog/game-catalog-provider';
import { apiError } from '../common/api-error';
import { isUniqueViolation } from '../database/postgres-errors';
import {
  type DealDto,
  dealFields,
  DealsService,
  type PriceSourceDto,
} from '../deals/deals.service';
import {
  discountPercent,
  type GamePrices,
  type Money,
  type PriceShop,
  PriceUnavailableError,
} from '../deals/price-provider';
import { type PlatformResponseDto, toPlatformResponse } from '../platforms/platforms.controller';
import { WishlistItem } from './wishlist-item.entity';
import { ActivityType } from '../activity/activity.entity';
import { ActivityService } from '../activity/activity.service';

/** Generous, but bounded: every item is priced on each visit (decision #66). */
export const WISHLIST_MAX = 200;
/** Price history shown for the last year. */
const HISTORY_DAYS = 365;

export enum WishlistErrorCode {
  ItemNotFound = 'WISHLIST_ITEM_NOT_FOUND',
  ItemExists = 'WISHLIST_ITEM_EXISTS',
  LimitReached = 'WISHLIST_LIMIT_REACHED',
  PriceNotAvailable = 'PRICE_NOT_AVAILABLE',
}

export type WishlistPriceDealDto = Omit<DealDto, 'priceGameId' | 'title' | 'imageUrl'>;

export interface WishlistPriceDto {
  /** False when the price source doesn't have this game. */
  found: boolean;
  /** Cheapest current price among the source's shops (on sale or not). */
  best: WishlistPriceDealDto | null;
  /** Lowest price ever recorded by the source, if it reports one. */
  historyLow: Money | null;
  /** Null without a target or when the currencies differ (prices aren't comparable). */
  reachedTarget: boolean | null;
}

export interface WishlistItemDto {
  id: string;
  createdAt: Date;
  game: {
    gameId: string;
    provider: CatalogProvider;
    externalId: string;
    name: string;
    coverUrl: string | null;
    releaseDate: string | null;
    platforms: PlatformResponseDto[];
  };
  targetPrice: Money | null;
  /** Null when prices are not configured or unavailable right now. */
  price: WishlistPriceDto | null;
}

export interface WishlistResponseDto extends PriceSourceDto {
  items: WishlistItemDto[];
}

export interface PricePointDto {
  timestamp: string;
  shop: PriceShop;
  price: Money;
  regular: Money | null;
  cut: number | null;
}

export interface PriceHistoryResponseDto extends PriceSourceDto {
  /** Real changes recorded by the source (oldest first); empty when it has none. */
  points: PricePointDto[];
}

/** A user's wishlist with prices and target prices (decision #66). */
@Injectable()
export class WishlistService {
  private readonly logger = new Logger(WishlistService.name);

  constructor(
    @InjectRepository(WishlistItem) private readonly items: Repository<WishlistItem>,
    private readonly dataSource: DataSource,
    private readonly catalogImport: CatalogImportService,
    private readonly deals: DealsService,
    private readonly activity: ActivityService,
  ) {}

  async list(userId: string, country: string): Promise<WishlistResponseDto> {
    const items = await this.items.find({
      where: { userId },
      relations: { game: { platforms: true } },
      order: { createdAt: 'DESC' },
    });
    const { prices, available } = await this.pricesOf(items, country);
    return {
      ...this.deals.sourceInfo(country, available),
      items: items.map((item) => toItemDto(item, prices)),
    };
  }

  /** Adds a catalog game, importing it like the library does. */
  async add(
    userId: string,
    provider: string,
    externalId: string,
    country: string,
  ): Promise<WishlistItemDto> {
    let gameId: string;
    try {
      gameId = (await this.catalogImport.importGame(provider as CatalogProvider, externalId)).id;
    } catch (error) {
      if (error instanceof CatalogGameNotFoundError) {
        throw apiError(HttpStatus.NOT_FOUND, 'CATALOG_GAME_NOT_FOUND', 'Catalog game not found');
      }
      if (error instanceof CatalogUnavailableError) {
        throw apiError(
          HttpStatus.SERVICE_UNAVAILABLE,
          'CATALOG_UNAVAILABLE',
          'The game catalog is not available right now',
        );
      }
      throw error;
    }

    let id: string;
    try {
      id = await this.dataSource.transaction(async (manager) => {
        // Serializes concurrent adds of the same user, so the limit holds.
        await manager.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
        const repository = manager.getRepository(WishlistItem);
        if (await repository.existsBy({ userId, gameId })) {
          throw itemExists();
        }
        if ((await repository.countBy({ userId })) >= WISHLIST_MAX) {
          throw apiError(
            HttpStatus.CONFLICT,
            WishlistErrorCode.LimitReached,
            `A wishlist can have at most ${WISHLIST_MAX} games`,
          );
        }
        return (await repository.save(repository.create({ userId, gameId }))).id;
      });
    } catch (error) {
      throw isUniqueViolation(error) ? itemExists() : error;
    }
    await this.activity.record(userId, ActivityType.Wishlisted, { gameId });
    return this.get(userId, id, country);
  }

  async get(userId: string, id: string, country: string): Promise<WishlistItemDto> {
    const item = await this.find(userId, id, true);
    const { prices } = await this.pricesOf([item], country);
    return toItemDto(item, prices);
  }

  /**
   * Sets (or clears, with null) the target price. It's kept in the currency of
   * the game's current price in `country`, so it can only be set when the
   * source has one.
   */
  async setTarget(
    userId: string,
    id: string,
    targetPrice: number | null,
    country: string,
  ): Promise<WishlistItemDto> {
    const item = await this.find(userId, id, true);
    if (targetPrice === null) {
      item.targetPrice = null;
      item.targetCurrency = null;
    } else {
      const { prices } = await this.pricesOf([item], country);
      const currency = prices.get(item.game.externalId!)?.deals[0]?.price.currency;
      if (!currency) {
        throw apiError(
          HttpStatus.CONFLICT,
          WishlistErrorCode.PriceNotAvailable,
          'There is no current price to compare a target price with',
        );
      }
      item.targetPrice = targetPrice.toFixed(2);
      item.targetCurrency = currency;
    }
    await this.items.save(item);
    return this.get(userId, id, country);
  }

  async remove(userId: string, id: string): Promise<void> {
    const result = await this.items.delete({ userId, id });
    if (!result.affected) {
      throw itemNotFound();
    }
  }

  /** Real price history of the game (last year), only what the source recorded. */
  async history(
    userId: string,
    id: string,
    country: string,
    now = new Date(),
  ): Promise<PriceHistoryResponseDto> {
    const item = await this.find(userId, id, true);
    const { prices, available } = await this.pricesOf([item], country);
    const game = prices.get(item.game.externalId!);
    if (!available || !game) {
      return { ...this.deals.sourceInfo(country, available), points: [] };
    }
    try {
      const since = new Date(now.getTime() - HISTORY_DAYS * 24 * 60 * 60 * 1000);
      const points = await this.deals.history(game.priceGameId, since, country);
      return {
        ...this.deals.sourceInfo(country),
        points: points.map((point) => ({
          ...point,
          cut: point.regular ? discountPercent(point.price, point.regular) : null,
        })),
      };
    } catch (error) {
      this.logPriceFailure(error);
      return { ...this.deals.sourceInfo(country, false), points: [] };
    }
  }

  /** Only the user's own items: someone else's id is "not found". */
  private async find(userId: string, id: string, withGame: boolean): Promise<WishlistItem> {
    const item = await this.items.findOne({
      where: { userId, id },
      relations: withGame ? { game: { platforms: true } } : {},
    });
    if (!item) {
      throw itemNotFound();
    }
    return item;
  }

  /** Prices of the items' games; failures leave prices out (`available: false`). */
  private async pricesOf(
    items: WishlistItem[],
    country: string,
  ): Promise<{ prices: Map<string, GamePrices | null>; available: boolean }> {
    if (items.length === 0 || !this.deals.isConfigured) {
      return { prices: new Map(), available: true };
    }
    try {
      const prices = await this.deals.pricesFor(
        items.map((item) => ({ externalId: item.game.externalId!, name: item.game.name })),
        country,
      );
      return { prices, available: true };
    } catch (error) {
      this.logPriceFailure(error);
      return { prices: new Map(), available: false };
    }
  }

  private logPriceFailure(error: unknown): void {
    if (error instanceof PriceUnavailableError) {
      this.logger.warn(`Wishlist prices unavailable: ${error.message}`);
    } else {
      this.logger.error('Unexpected wishlist prices failure', error);
    }
  }
}

function toItemDto(item: WishlistItem, prices: Map<string, GamePrices | null>): WishlistItemDto {
  const { game } = item;
  const targetPrice =
    item.targetPrice !== null && item.targetCurrency !== null
      ? { amount: Number(item.targetPrice), currency: item.targetCurrency }
      : null;
  let price: WishlistPriceDto | null = null;
  if (prices.has(game.externalId!)) {
    const gamePrices = prices.get(game.externalId!) ?? null;
    const best = gamePrices?.deals[0] ?? null;
    price = {
      found: gamePrices !== null,
      best: best ? dealFields(best) : null,
      historyLow: gamePrices?.historyLow ?? null,
      reachedTarget:
        targetPrice && best && best.price.currency === targetPrice.currency
          ? best.price.amount <= targetPrice.amount
          : null,
    };
  }
  return {
    id: item.id,
    createdAt: item.createdAt,
    game: {
      gameId: game.id,
      provider: game.provider!,
      externalId: game.externalId!,
      name: game.name,
      coverUrl: game.coverAssetKey ? assetUrl(game.coverAssetKey) : null,
      releaseDate: game.releaseDate,
      platforms: [...game.platforms]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(toPlatformResponse),
    },
    targetPrice,
    price,
  };
}

function itemNotFound() {
  return apiError(HttpStatus.NOT_FOUND, WishlistErrorCode.ItemNotFound, 'Wishlist item not found');
}

function itemExists() {
  return apiError(
    HttpStatus.CONFLICT,
    WishlistErrorCode.ItemExists,
    'This game is already in the wishlist',
  );
}
