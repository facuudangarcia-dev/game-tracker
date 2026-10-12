import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { assetUrl } from '../catalog/catalog-urls';
import {
  CatalogUnavailableError,
  GAME_CATALOG_PROVIDER,
  type GameCatalogProvider,
} from '../catalog/game-catalog-provider';
import { TtlCache } from '../catalog/ttl-cache';
import type { EnvironmentVariables } from '../config/env.validation';
import { PlayStatus } from '../library/library.constants';
import {
  type DealListItem,
  type DealsPage,
  type DealsQuery,
  discountPercent,
  type GamePrices,
  type Money,
  type PriceDeal,
  type PricePoint,
  PRICE_PROVIDER,
  type PriceProvider,
  type PriceShop,
  PriceUnavailableError,
} from './price-provider';

export const DEALS_PAGE_SIZE = 24;
export const RECOMMENDED_DEALS_LIMIT = 8;
/** Pending library games considered for the Home's recommended deals. */
const PENDING_GAMES_LIMIT = 30;
const DEALS_TTL_MS = 10 * 60 * 1000;
const SHOPS_TTL_MS = 24 * 60 * 60 * 1000;
const PRICES_TTL_MS = 30 * 60 * 1000;
const HISTORY_TTL_MS = 6 * 60 * 60 * 1000;
/** Which source game a catalog game is rarely changes. */
const LOOKUP_TTL_MS = 24 * 60 * 60 * 1000;

export interface DealDto {
  priceGameId: string;
  title: string;
  imageUrl: string | null;
  shop: PriceShop;
  price: Money;
  regular: Money;
  /** Discount computed from `price` and `regular`; null if they can't be compared. */
  cut: number | null;
  storeLow: Money | null;
  historyLow: Money | null;
  platforms: string[];
  drm: string[];
  voucher: string | null;
  timestamp: string;
  expiry: string | null;
  url: string;
}

export interface PriceSourceDto {
  /** False without credentials: the UI explains what to configure. */
  configured: boolean;
  /** False when the source failed this time. */
  available: boolean;
  /** Country (ISO 3166-1 alpha-2) the prices are for. */
  country: string;
  /** Credit required by the source's terms. */
  source: { name: string; url: string };
}

export interface DealsResponseDto extends PriceSourceDto {
  /** When these results were fetched from the source (they're cached a few minutes). */
  fetchedAt: string | null;
  items: DealDto[];
  hasMore: boolean;
  nextOffset: number | null;
}

export interface ShopsResponseDto extends PriceSourceDto {
  shops: PriceShop[];
}

/** Current PC prices of one catalog game (its page). */
export interface GamePricesResponseDto extends PriceSourceDto {
  /** False when the price source doesn't have this game. */
  found: boolean;
  /** Price in each shop (on sale or not), cheapest first. */
  deals: Omit<DealDto, 'priceGameId' | 'title' | 'imageUrl'>[];
  /** Lowest price ever recorded by the source, if it reports one. */
  historyLow: Money | null;
}

/** Shops listed on a game's page. */
export const GAME_PRICES_SHOPS_LIMIT = 5;

export type DealReason = 'wishlist' | 'pending';

export interface RecommendedDealDto extends DealDto {
  /** Why it's recommended to this user; null for general deals. */
  reason: DealReason | null;
  /** The catalog game, for deals of the user's own games. */
  catalogGame: { provider: string; externalId: string } | null;
}

export interface RecommendedDealsResponseDto extends PriceSourceDto {
  /** True when some deal matches the user's wishlist or pending games. */
  personalized: boolean;
  items: RecommendedDealDto[];
}

/** A catalog game to price: the external id and its name (for title lookups). */
export interface PricedGame {
  externalId: string;
  name: string;
}

interface CatalogGameRow {
  external_id: string;
  name: string;
  cover_asset_key: string | null;
}

/**
 * Deals and prices from the external price source (decision #66), always
 * through the backend (the key never reaches the browser) and cached. Prices
 * are per country (decision #68): each request says which one, else
 * ITAD_COUNTRY.
 */
@Injectable()
export class DealsService {
  private readonly logger = new Logger(DealsService.name);
  private readonly dealsCache = new TtlCache<{ page: DealsPage; fetchedAt: string }>(
    DEALS_TTL_MS,
    200,
  );
  private readonly shopsCache = new TtlCache<PriceShop[]>(SHOPS_TTL_MS, 300);
  private readonly pricesCache = new TtlCache<GamePrices | null>(PRICES_TTL_MS, 2000);
  private readonly historyCache = new TtlCache<PricePoint[]>(HISTORY_TTL_MS, 500);
  private readonly lookupCache = new TtlCache<string | null>(LOOKUP_TTL_MS, 5000);
  /** Country used when a request doesn't say one. */
  private readonly defaultCountry: string;

  constructor(
    @Inject(PRICE_PROVIDER) private readonly prices: PriceProvider,
    @Inject(GAME_CATALOG_PROVIDER) private readonly catalog: GameCatalogProvider,
    private readonly dataSource: DataSource,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.defaultCountry = config.get('ITAD_COUNTRY', { infer: true });
  }

  /** The requested country, else the default one. */
  country(requested?: string | null): string {
    return requested || this.defaultCountry;
  }

  /** For tests. */
  clearCache(): void {
    for (const cache of [
      this.dealsCache,
      this.shopsCache,
      this.pricesCache,
      this.historyCache,
      this.lookupCache,
    ]) {
      cache.clear();
    }
  }

  get isConfigured(): boolean {
    return this.prices.isConfigured;
  }

  sourceInfo(country: string, available = true): PriceSourceDto {
    return {
      configured: this.prices.isConfigured,
      available: this.prices.isConfigured && available,
      country,
      source: this.prices.attribution,
    };
  }

  async list(query: DealsQuery): Promise<DealsResponseDto> {
    const empty = { fetchedAt: null, items: [], hasMore: false, nextOffset: null };
    const info = (available = true) => this.sourceInfo(query.country, available);
    if (!this.prices.isConfigured) {
      return { ...info(), ...empty };
    }
    const key = JSON.stringify(query);
    let cached = this.dealsCache.get(key);
    if (!cached) {
      try {
        cached = { page: await this.prices.listDeals(query), fetchedAt: new Date().toISOString() };
        this.dealsCache.set(key, cached);
      } catch (error) {
        this.logFailure('deals', error);
        return { ...info(false), ...empty };
      }
    }
    return {
      ...info(),
      fetchedAt: cached.fetchedAt,
      items: cached.page.items.map(toDealDto),
      hasMore: cached.page.hasMore,
      nextOffset: cached.page.nextOffset,
    };
  }

  async shops(country: string): Promise<ShopsResponseDto> {
    if (!this.prices.isConfigured) {
      return { ...this.sourceInfo(country), shops: [] };
    }
    let shops = this.shopsCache.get(country);
    if (!shops) {
      try {
        shops = await this.prices.listShops(country);
        this.shopsCache.set(country, shops);
      } catch (error) {
        this.logFailure('shops', error);
        return { ...this.sourceInfo(country, false), shops: [] };
      }
    }
    return { ...this.sourceInfo(country), shops };
  }

  /**
   * Current prices of catalog games (null = not found in the source). Games are
   * matched by Steam app id when the catalog knows it, else by exact title.
   * @throws PriceUnavailableError
   */
  async pricesFor(games: PricedGame[], country: string): Promise<Map<string, GamePrices | null>> {
    const ids = await this.priceGameIds(games);
    const key = (id: string) => `${country}:${id}`;
    const wanted = [...new Set([...ids.values()].filter((id): id is string => id !== null))];
    const missing = wanted.filter((id) => this.pricesCache.get(key(id)) === undefined);
    if (missing.length > 0) {
      const fetched = await this.prices.getPrices(missing, country);
      for (const id of missing) {
        this.pricesCache.set(key(id), fetched.get(id) ?? null);
      }
    }
    return new Map(
      games.map((game) => {
        const id = ids.get(game.externalId) ?? null;
        return [game.externalId, id ? (this.pricesCache.get(key(id)) ?? null) : null];
      }),
    );
  }

  /**
   * Current prices of a catalog game in `country`, for its page. `name` is
   * resolved by the backend (never taken from the client): it's used to look
   * the game up when the catalog has no Steam id.
   */
  async gamePrices(
    externalId: string,
    name: string,
    country: string,
  ): Promise<GamePricesResponseDto> {
    const empty = { found: false, deals: [], historyLow: null };
    if (!this.prices.isConfigured) {
      return { ...this.sourceInfo(country), ...empty };
    }
    try {
      const game = (await this.pricesFor([{ externalId, name }], country)).get(externalId);
      if (!game) {
        return { ...this.sourceInfo(country), ...empty };
      }
      return {
        ...this.sourceInfo(country),
        found: true,
        deals: game.deals.slice(0, GAME_PRICES_SHOPS_LIMIT).map(dealFields),
        historyLow: game.historyLow,
      };
    } catch (error) {
      this.logFailure('game prices', error);
      return { ...this.sourceInfo(country, false), ...empty };
    }
  }

  /** @throws PriceUnavailableError */
  async history(priceGameId: string, since: Date, country: string): Promise<PricePoint[]> {
    const key = `${country}:${priceGameId}`;
    let points = this.historyCache.get(key);
    if (!points) {
      points = await this.prices.getHistory(priceGameId, since, country);
      this.historyCache.set(key, points);
    }
    return points;
  }

  /**
   * Deals for the Home. With a session, deals of the user's wishlist and pending
   * games come first (real matches only); general deals fill the rest.
   */
  async recommended(userId: string | null, country: string): Promise<RecommendedDealsResponseDto> {
    if (!this.prices.isConfigured) {
      return { ...this.sourceInfo(country), personalized: false, items: [] };
    }
    const items: RecommendedDealDto[] = [];
    if (userId) {
      try {
        items.push(...(await this.personalDeals(userId, country)));
      } catch (error) {
        this.logFailure('recommended deals', error);
        return { ...this.sourceInfo(country, false), personalized: false, items: [] };
      }
    }
    const personalized = items.length > 0;
    if (items.length < RECOMMENDED_DEALS_LIMIT) {
      const general = await this.list({
        country,
        sort: 'relevance',
        shopIds: [],
        platform: null,
        type: null,
        minCut: null,
        minPrice: null,
        maxPrice: null,
        offset: 0,
        limit: DEALS_PAGE_SIZE,
      });
      if (!general.available && items.length === 0) {
        return { ...this.sourceInfo(country, false), personalized: false, items: [] };
      }
      const seen = new Set(items.map((item) => item.priceGameId));
      for (const deal of general.items) {
        if (items.length >= RECOMMENDED_DEALS_LIMIT) {
          break;
        }
        if (!seen.has(deal.priceGameId)) {
          items.push({ ...deal, reason: null, catalogGame: null });
        }
      }
    }
    return {
      ...this.sourceInfo(country),
      personalized,
      items: items.slice(0, RECOMMENDED_DEALS_LIMIT),
    };
  }

  /** Discounted deals of the user's wishlist (first) and pending games. Only their rows. */
  private async personalDeals(userId: string, country: string): Promise<RecommendedDealDto[]> {
    const provider = this.catalog.id;
    const [wishlist, pending] = await Promise.all([
      this.dataSource.query<CatalogGameRow[]>(
        `SELECT g.external_id, g.name, g.cover_asset_key
           FROM wishlist_items w JOIN games g ON g.id = w.game_id
          WHERE w.user_id = $1 AND g.provider = $2
          ORDER BY w.created_at DESC`,
        [userId, provider],
      ),
      this.dataSource.query<CatalogGameRow[]>(
        `SELECT DISTINCT ON (g.id) g.external_id, g.name, g.cover_asset_key
           FROM user_games ug
           JOIN games g ON g.id = ug.game_id
           JOIN user_game_summaries s ON s.user_game_id = ug.id
          WHERE ug.user_id = $1 AND g.provider = $2 AND s.status = $3
          ORDER BY g.id
          LIMIT ${PENDING_GAMES_LIMIT}`,
        [userId, provider, PlayStatus.Pending],
      ),
    ]);
    const reasons = new Map<string, { row: CatalogGameRow; reason: DealReason }>();
    for (const row of wishlist) {
      reasons.set(row.external_id, { row, reason: 'wishlist' });
    }
    for (const row of pending) {
      if (!reasons.has(row.external_id)) {
        reasons.set(row.external_id, { row, reason: 'pending' });
      }
    }
    if (reasons.size === 0) {
      return [];
    }
    const prices = await this.pricesFor(
      [...reasons.values()].map(({ row }) => ({ externalId: row.external_id, name: row.name })),
      country,
    );
    const items: RecommendedDealDto[] = [];
    for (const [externalId, { row, reason }] of reasons) {
      const game = prices.get(externalId);
      const best = game?.deals[0];
      if (!game || !best || (discountPercent(best.price, best.regular) ?? 0) <= 0) {
        continue;
      }
      items.push({
        ...toDealDto({
          priceGameId: game.priceGameId,
          title: row.name,
          kind: 'game',
          imageUrl: row.cover_asset_key ? assetUrl(row.cover_asset_key) : null,
          deal: best,
        }),
        reason,
        catalogGame: { provider, externalId },
      });
    }
    return items.sort(
      (a, b) =>
        (a.reason === 'wishlist' ? 0 : 1) - (b.reason === 'wishlist' ? 0 : 1) ||
        (b.cut ?? 0) - (a.cut ?? 0),
    );
  }

  private async priceGameIds(games: PricedGame[]): Promise<Map<string, string | null>> {
    const result = new Map<string, string | null>();
    const missing: PricedGame[] = [];
    for (const game of games) {
      const cached = this.lookupCache.get(game.externalId);
      if (cached === undefined) {
        missing.push(game);
      } else {
        result.set(game.externalId, cached);
      }
    }
    if (missing.length === 0) {
      return result;
    }
    let storeIds = new Map<string, { steamAppId: string | null }>();
    try {
      storeIds = await this.catalog.getStoreIds(missing.map((game) => game.externalId));
    } catch (error) {
      // Without the catalog, titles still work.
      if (!(error instanceof CatalogUnavailableError)) {
        throw error;
      }
      this.logger.warn(`Store ids unavailable, matching by title: ${error.message}`);
    }
    const found = await this.prices.findGameIds(
      missing.map((game) => ({
        key: game.externalId,
        steamAppId: storeIds.get(game.externalId)?.steamAppId ?? null,
        title: game.name,
      })),
    );
    for (const game of missing) {
      const id = found.get(game.externalId) ?? null;
      this.lookupCache.set(game.externalId, id);
      result.set(game.externalId, id);
    }
    return result;
  }

  private logFailure(what: string, error: unknown): void {
    if (error instanceof PriceUnavailableError) {
      this.logger.warn(`Price source unavailable (${what}): ${error.message}`);
    } else {
      this.logger.error(`Unexpected price source failure (${what})`, error);
    }
  }
}

export function toDealDto(item: DealListItem): DealDto {
  const { deal } = item;
  return {
    priceGameId: item.priceGameId,
    title: item.title,
    imageUrl: item.imageUrl,
    ...dealFields(deal),
  };
}

export function dealFields(deal: PriceDeal): Omit<DealDto, 'priceGameId' | 'title' | 'imageUrl'> {
  return {
    shop: deal.shop,
    price: deal.price,
    regular: deal.regular,
    cut: discountPercent(deal.price, deal.regular),
    storeLow: deal.storeLow,
    historyLow: deal.historyLow,
    platforms: deal.platforms,
    drm: deal.drm,
    voucher: deal.voucher,
    timestamp: deal.timestamp,
    expiry: deal.expiry,
    url: deal.url,
  };
}
