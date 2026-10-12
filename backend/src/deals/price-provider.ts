/**
 * Abstraction over external price sources (IsThereAnyDeal first, decision #66).
 * Implementations validate what the source returns: anything malformed is
 * dropped, never shown. Amounts are in the source's currency, never converted.
 */

export enum PriceProviderId {
  Itad = 'itad',
}

export interface Money {
  amount: number;
  /** ISO 4217, as reported by the source. */
  currency: string;
}

export interface PriceShop {
  id: number;
  name: string;
}

export interface PriceDeal {
  shop: PriceShop;
  price: Money;
  /** Price without discount, as reported by the source. */
  regular: Money;
  /** Lowest price in this shop according to the source, if reported. */
  storeLow: Money | null;
  /** Lowest price ever recorded by the source (any shop), if reported. */
  historyLow: Money | null;
  /** Operating systems (e.g. "Windows") as named by the source. */
  platforms: string[];
  /** DRM / launcher names (e.g. "Steam"). */
  drm: string[];
  voucher: string | null;
  /** When the source recorded this price (ISO 8601). */
  timestamp: string;
  /** When the offer ends (ISO 8601), only if the source knows it. */
  expiry: string | null;
  /** Link to the offer (the source's redirect link, kept unchanged). */
  url: string;
}

/**
 * Kind of product (decision #74), from the source's own classification: games
 * include packages and editions; "other" is what the source doesn't classify
 * (some soundtracks, software, courses, demos).
 */
export type DealsType = 'game' | 'dlc' | 'other';

/** A game of the source with its best current deal. */
export interface DealListItem {
  priceGameId: string;
  title: string;
  kind: DealsType;
  /** Wide image (banner) or box art, if the source has one. */
  imageUrl: string | null;
  deal: PriceDeal;
}

export type DealsSort = 'relevance' | 'cut' | 'price';
export type DealsPlatform = 'windows' | 'mac' | 'linux';

export interface DealsQuery {
  /** ISO 3166-1 alpha-2 country whose prices are asked for. */
  country: string;
  sort: DealsSort;
  shopIds: number[];
  platform: DealsPlatform | null;
  /** Only this kind of product; null for everything. */
  type: DealsType | null;
  minCut: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  offset: number;
  limit: number;
}

export interface DealsPage {
  items: DealListItem[];
  hasMore: boolean;
  nextOffset: number | null;
}

/** Current prices of one game in every shop (on sale or not), cheapest first. */
export interface GamePrices {
  priceGameId: string;
  deals: PriceDeal[];
  /** Lowest price ever recorded by the source, if reported. */
  historyLow: Money | null;
}

export interface PricePoint {
  timestamp: string;
  shop: PriceShop;
  price: Money;
  regular: Money | null;
}

/** A catalog game to find in the price source. `key` identifies it in the result. */
export interface PriceLookup {
  key: string;
  steamAppId: string | null;
  title: string;
}

export interface PriceProvider {
  readonly id: PriceProviderId;
  /** False without credentials: every call throws PriceUnavailableError. */
  readonly isConfigured: boolean;
  /** Name and site to credit, as the source's terms require. */
  readonly attribution: { name: string; url: string };
  listDeals(query: DealsQuery): Promise<DealsPage>;
  /** Prices and shops depend on the country (ISO 3166-1 alpha-2). */
  listShops(country: string): Promise<PriceShop[]>;
  /** Source game id of each lookup (null when not found). */
  findGameIds(lookups: PriceLookup[]): Promise<Map<string, string | null>>;
  getPrices(priceGameIds: string[], country: string): Promise<Map<string, GamePrices>>;
  getHistory(priceGameId: string, since: Date, country: string): Promise<PricePoint[]>;
}

export const PRICE_PROVIDER = Symbol('PRICE_PROVIDER');

/** The source can't be reached, failed, rate-limited us or is not configured. */
export class PriceUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'PriceUnavailableError';
  }
}

/**
 * Discount computed from the real prices (not taken as given), rounded down so
 * it's never overstated. Null when the prices can't be compared.
 */
export function discountPercent(price: Money, regular: Money): number | null {
  if (price.currency !== regular.currency || regular.amount <= 0 || price.amount > regular.amount) {
    return null;
  }
  return Math.floor((1 - price.amount / regular.amount) * 100 + 1e-9);
}
