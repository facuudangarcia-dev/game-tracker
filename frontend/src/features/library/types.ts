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

export interface UserGameDetails extends Omit<UserGameListItem, 'game'> {
  game: GameDetails;
  notes: string | null;
  playthroughs: Playthrough[];
  difficulties: Difficulty[];
}

/** Exactly one game source (catalog result, existing game or new manual game). */
export type AddUserGameInput = { platformId: string } & (
  | { gameId: string }
  | { catalog: { provider: string; externalId: string } }
  | { manualGame: { name: string } }
);
