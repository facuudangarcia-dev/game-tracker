import type { Genre, Platform } from '../library/types';

/** A catalog game as a card (Discover, releases, recommendations), with the user's presence. */
export interface CatalogCard {
  provider: string;
  externalId: string;
  name: string;
  releaseDate: string | null;
  coverUrl: string | null;
  artworkUrl: string | null;
  platforms: Platform[];
  /** Platforms on which the current user already has the game. */
  libraryPlatformIds: string[];
  wishlistItemId: string | null;
}

export type DiscoverSort = 'popular' | 'top-rated' | 'newest' | 'anticipated';

export interface DiscoverFilters {
  platform?: string;
  genre?: string;
  /** `upcoming`, `recent` or a year. */
  release?: string;
  sort?: DiscoverSort;
}

export interface DiscoverPage {
  games: CatalogCard[];
  page: number;
  hasMore: boolean;
  catalogAvailable: boolean;
}

export interface Recommendations {
  personalized: boolean;
  basedOnGenres: Genre[];
  games: CatalogCard[];
  catalogAvailable: boolean;
}

/** `day` = confirmed date; the others are estimated by the source. */
export type DatePrecision = 'day' | 'month' | 'quarter' | 'year';

export interface Release extends CatalogCard {
  date: string;
  precision: DatePrecision;
  releasePlatforms: Platform[];
}

export interface Releases {
  releases: Release[];
  catalogAvailable: boolean;
}

export interface UndatedGames {
  games: CatalogCard[];
  catalogAvailable: boolean;
}

export interface Money {
  amount: number;
  currency: string;
}

export interface Shop {
  id: number;
  name: string;
}

/** Whether the price source is configured and answered (and whom to credit). */
export interface PriceSource {
  configured: boolean;
  available: boolean;
  country: string;
  source: { name: string; url: string };
}

export interface DealPrice {
  shop: Shop;
  price: Money;
  regular: Money;
  /** Computed by the backend from the real prices; null if not comparable. */
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

export interface Deal extends DealPrice {
  priceGameId: string;
  title: string;
  imageUrl: string | null;
}

export type DealsSort = 'relevance' | 'cut' | 'price';
export type DealsPlatform = 'windows' | 'mac' | 'linux';
export type DealsType = 'game' | 'dlc' | 'other';

export interface DealsFilters {
  sort?: DealsSort;
  shop?: number;
  platform?: DealsPlatform;
  type?: DealsType;
  minCut?: number;
  maxPrice?: number;
}

export interface DealsPage extends PriceSource {
  fetchedAt: string | null;
  items: Deal[];
  hasMore: boolean;
  nextOffset: number | null;
}

export interface Shops extends PriceSource {
  shops: Shop[];
}

export interface RecommendedDeal extends Deal {
  reason: 'wishlist' | 'pending' | null;
  catalogGame: { provider: string; externalId: string } | null;
}

export interface RecommendedDeals extends PriceSource {
  personalized: boolean;
  items: RecommendedDeal[];
}

export interface WishlistPrice {
  found: boolean;
  best: DealPrice | null;
  historyLow: Money | null;
  reachedTarget: boolean | null;
}

export interface WishlistItem {
  id: string;
  createdAt: string;
  game: {
    gameId: string;
    provider: string;
    externalId: string;
    name: string;
    coverUrl: string | null;
    releaseDate: string | null;
    platforms: Platform[];
  };
  targetPrice: Money | null;
  price: WishlistPrice | null;
}

export interface Wishlist extends PriceSource {
  items: WishlistItem[];
}

/** Current PC prices of one catalog game (its page). */
export interface GamePrices extends PriceSource {
  found: boolean;
  /** Price in each shop, cheapest first. */
  deals: DealPrice[];
  historyLow: Money | null;
}

export interface PricePoint {
  timestamp: string;
  shop: Shop;
  price: Money;
  regular: Money | null;
  cut: number | null;
}

export interface PriceHistory extends PriceSource {
  points: PricePoint[];
}

export type NewsCategory = 'playstation' | 'xbox' | 'nintendo' | 'pc';
export type NewsFilter = NewsCategory | 'general';

export interface NewsArticle {
  id: string;
  title: string;
  summary: string | null;
  url: string;
  imageUrl: string | null;
  source: string;
  publishedAt: string;
  categories: NewsCategory[];
}

export interface NewsPage {
  /** Language of the articles: the interface's, or the other one when it has no outlets. */
  language: 'es' | 'en';
  configured: boolean;
  available: boolean;
  sources: string[];
  failedSources: string[];
  fetchedAt: string | null;
  items: NewsArticle[];
  total: number;
  page: number;
  hasMore: boolean;
}
