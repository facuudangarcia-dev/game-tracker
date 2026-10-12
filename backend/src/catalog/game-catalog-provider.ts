import type { CatalogProvider } from './catalog-provider';

/** A game as returned by a provider search (lightweight). */
export interface CatalogGameSummary {
  externalId: string;
  name: string;
  /** YYYY-MM-DD (first release), if known. */
  releaseDate: string | null;
  /** Provider-specific image reference, resolved through `fetchImage`. */
  coverRef: string | null;
  /** Provider platform ids; unknown ones are dropped when mapping. */
  platformExternalIds: string[];
}

export interface CatalogGenreRef {
  externalId: string;
  name: string;
}

/** Full data needed to import a game. */
export interface CatalogGameDetails extends CatalogGameSummary {
  slug: string | null;
  /** Wide image (artwork, else screenshot), if the provider has one. */
  artworkRef: string | null;
  /** In-game screenshots (image refs), most relevant first. */
  screenshotRefs: string[];
  /** Similar games according to the provider (allowed types, with cover, no adult content). */
  similarGames: CatalogGameSummary[];
  summary: string | null;
  genres: CatalogGenreRef[];
  developers: string[];
  publishers: string[];
}

/** An entry of a provider's taxonomy (platforms, genres), used to verify mappings. */
export interface CatalogTaxonomyEntry {
  externalId: string;
  name: string;
  slug: string | null;
}

/** `artwork` is a wide, high-resolution image (key art or screenshot) for hero backgrounds. */
export type CatalogImageVariant = 'thumbnail' | 'cover' | 'artwork' | 'screenshot';

/** Lists of notable games shown on the Home (docs/decisions.md #53). */
export type CatalogHighlightKind = 'recent' | 'upcoming';

export interface CatalogHighlight extends CatalogGameSummary {
  /** Wide image (artwork, else screenshot), if the provider has one. */
  artworkRef: string | null;
}

export interface CatalogImage {
  data: Buffer;
  contentType: string;
}

/** Order of the Discover grid (decision #64). */
export type CatalogDiscoverSort = 'popular' | 'top-rated' | 'newest' | 'anticipated';

/** Filters of the Discover grid; ids are the provider's. Dates are YYYY-MM-DD (inclusive). */
export interface CatalogDiscoverFilter {
  platformExternalIds: string[];
  genreExternalIds: string[];
  releasedFrom: string | null;
  releasedTo: string | null;
  sort: CatalogDiscoverSort;
  /** Games never returned (e.g. already in the user's library). */
  excludeExternalIds: string[];
  limit: number;
  offset: number;
}

/** How precise a release date is: estimated dates are a month, a quarter or a year. */
export type ReleaseDatePrecision = 'day' | 'month' | 'quarter' | 'year';

/** A game released (or to be released) on a date of the requested range. */
export interface CatalogRelease extends CatalogHighlight {
  /** YYYY-MM-DD; for estimated dates, a day inside the period (month, quarter or year). */
  date: string;
  precision: ReleaseDatePrecision;
  /** Provider platform ids released on that date (a subset of the game's). */
  releasePlatformExternalIds: string[];
}

export interface CatalogReleaseFilter {
  platformExternalIds: string[];
  genreExternalIds: string[];
}

/** Ids of a game in other stores, to look prices up (decision #66). */
export interface CatalogStoreIds {
  steamAppId: string | null;
}

/**
 * Abstraction over external game catalogs (IGDB first). Implementations only
 * return entry types allowed by docs/decisions.md #27.
 */
export interface GameCatalogProvider {
  readonly id: CatalogProvider;
  searchGames(query: string, limit: number): Promise<CatalogGameSummary[]>;
  /** Null when the game doesn't exist or its type is not allowed. */
  getGame(externalId: string): Promise<CatalogGameDetails | null>;
  /** Notable games, most anticipated first; adult content excluded. */
  listHighlights(kind: CatalogHighlightKind, limit: number): Promise<CatalogHighlight[]>;
  /** Filtered catalog page for Discover (allowed types, with cover, no adult content). */
  discoverGames(filter: CatalogDiscoverFilter): Promise<CatalogHighlight[]>;
  /**
   * Games similar to the given ones (recommendations), most relevant first,
   * excluding `excludeExternalIds`.
   */
  listSimilarGames(
    externalIds: string[],
    excludeExternalIds: string[],
    limit: number,
  ): Promise<CatalogHighlight[]>;
  /** Notable games with a release date in [from, to] (YYYY-MM-DD), earliest first. */
  listReleases(from: string, to: string, filter: CatalogReleaseFilter): Promise<CatalogRelease[]>;
  /** Notable announced games without any release date yet, most anticipated first. */
  listUndatedGames(filter: CatalogReleaseFilter, limit: number): Promise<CatalogHighlight[]>;
  /** Store ids of the given games (missing games are absent from the map). */
  getStoreIds(externalIds: string[]): Promise<Map<string, CatalogStoreIds>>;
  /** Catalog games of the given Steam apps (decision #78): appId -> external id. */
  findBySteamAppIds(appIds: number[]): Promise<Map<number, string>>;
  isValidImageRef(ref: string): boolean;
  fetchImage(ref: string, variant: CatalogImageVariant): Promise<CatalogImage>;
  listPlatforms(): Promise<CatalogTaxonomyEntry[]>;
  listGenres(): Promise<CatalogTaxonomyEntry[]>;
}

export const GAME_CATALOG_PROVIDER = Symbol('GAME_CATALOG_PROVIDER');

/** The provider can't be reached, failed, or is not configured. */
export class CatalogUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'CatalogUnavailableError';
  }
}
