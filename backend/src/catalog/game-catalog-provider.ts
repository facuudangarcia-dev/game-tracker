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
export type CatalogImageVariant = 'thumbnail' | 'cover' | 'artwork';

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
