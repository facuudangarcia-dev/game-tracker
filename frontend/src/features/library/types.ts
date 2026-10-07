/** API shapes of the library and catalog (mirrors the backend DTOs). */

export type PlayStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
export type TimeMode = 'MANUAL' | 'SESSIONS';

export interface Platform {
  id: string;
  slug: string;
  name: string;
  shortName: string;
}

export interface Genre {
  id: string;
  slug: string;
  name: string;
}

export interface CatalogSearchResult {
  /** Set when the game already exists in our database (imported or manual). */
  gameId: string | null;
  provider: string | null;
  externalId: string | null;
  name: string;
  releaseDate: string | null;
  coverUrl: string | null;
  platforms: Platform[];
  isManual: boolean;
}

export interface CatalogSearchResponse {
  results: CatalogSearchResult[];
  catalogAvailable: boolean;
}

export interface GameSummary {
  id: string;
  name: string;
  coverUrl: string | null;
  isManual: boolean;
}

export interface GameDetails extends GameSummary {
  /** Catalog reference; null for manual games. */
  provider: string | null;
  externalId: string | null;
  slug: string | null;
  summary: string | null;
  releaseDate: string | null;
  developers: string[];
  publishers: string[];
  genres: Genre[];
}

export interface UserGameListItem {
  id: string;
  game: GameSummary;
  platform: Platform;
  status: PlayStatus;
  startDate: string | null;
  completionDate: string | null;
  totalMinutes: number;
  rating: number | null;
  platinumAchieved: boolean;
  createdAt: string;
}

export type DifficultyKind = 'PLAYTHROUGH' | 'PLATINUM';

export interface Difficulty {
  id: string;
  kind: DifficultyKind;
  name: string;
  position: number;
  /** In use: can be renamed but not deleted. */
  inUse: boolean;
}

export interface Playthrough {
  id: string;
  number: number;
  name: string | null;
  status: PlayStatus;
  startDate: string | null;
  completionDate: string | null;
  difficulty: { id: string; name: string } | null;
  timeMode: TimeMode;
  manualTimeMinutes: number;
  minutes: number;
  notes: string | null;
  createdAt: string;
}

export interface GamingSession {
  id: string;
  playthroughId: string;
  playthroughNumber: number;
  /** ISO date-time. */
  playedAt: string;
  durationMinutes: number;
  notes: string | null;
  /** False while its playthrough is in MANUAL mode (kept, but not counted). */
  countsTowardTime: boolean;
}

export interface Platinum {
  achieved: boolean;
  date: string | null;
  timeMinutes: number | null;
  difficulty: { id: string; name: string } | null;
}

export interface UserGameDetails extends Omit<UserGameListItem, 'game'> {
  game: GameDetails;
  notes: string | null;
  platinum: Platinum;
  playthroughs: Playthrough[];
  sessions: GamingSession[];
  difficulties: Difficulty[];
}

export type LibrarySortField =
  'name' | 'createdAt' | 'totalMinutes' | 'rating' | 'startDate' | 'completionDate';
export type SortOrder = 'asc' | 'desc';

/** Query of the library list (all optional; sent as query string). */
export interface LibraryFilters {
  search?: string;
  status?: PlayStatus;
  platformId?: string;
  genreId?: string;
  platinum?: 'true' | 'false';
  sort?: LibrarySortField;
  order?: SortOrder;
}

/** Settings of playthrough #1 chosen when adding a game. */
export interface InitialPlaythroughInput {
  status: PlayStatus;
  startDate?: string | null;
  completionDate?: string | null;
  /** One of the default difficulty names. */
  difficulty?: string | null;
}

/** Game source: catalog game (imported if needed), existing game or new manual game. */
export type GameSource =
  | { gameId: string }
  | { catalog: { provider: string; externalId: string } }
  | { manualGame: { name: string } };

/** Exactly one game source, a platform and optional initial settings. */
export type AddUserGameInput = {
  platformId: string;
  initialPlaythrough?: InitialPlaythroughInput;
  rating?: number | null;
} & GameSource;

/** A notable catalog game shown on the Home (recent or upcoming). */
export interface CatalogHighlight {
  provider: string;
  externalId: string;
  name: string;
  releaseDate: string | null;
  coverUrl: string | null;
  /** Wide high-resolution image for the hero, if any. */
  artworkUrl: string | null;
  platforms: Platform[];
}

export interface CatalogHighlights {
  recent: CatalogHighlight[];
  upcoming: CatalogHighlight[];
  catalogAvailable: boolean;
}

/** Public view of a catalog game ("this game exists"). */
export interface CatalogGame {
  /** Local id when already imported. */
  gameId: string | null;
  provider: string;
  externalId: string;
  name: string;
  summary: string | null;
  releaseDate: string | null;
  coverUrl: string | null;
  /** Wide high-resolution image for the page header, if any. */
  artworkUrl: string | null;
  platforms: Platform[];
  genres: { id: string | null; slug: string | null; name: string }[];
  developers: string[];
  publishers: string[];
  /** The current user's UserGames of this game. */
  /** In-game screenshots: gallery size and full size. */
  screenshots: { thumbnailUrl: string; fullUrl: string }[];
  /** Similar games according to the catalog. */
  relatedGames: RelatedGame[];
  /** The user's entries of this game (one per platform), with their progress. */
  libraryEntries: LibraryEntry[];
}

export interface RelatedGame {
  provider: string;
  externalId: string;
  name: string;
  releaseDate: string | null;
  coverUrl: string | null;
}

export interface LibraryEntry {
  userGameId: string;
  platform: Platform;
  status: PlayStatus;
  totalMinutes: number;
  rating: number | null;
  platinumAchieved: boolean;
}
