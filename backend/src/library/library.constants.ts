/** Status of a playthrough, and the derived status of a UserGame. */
export enum PlayStatus {
  Pending = 'PENDING',
  InProgress = 'IN_PROGRESS',
  /** Played, with no end to reach (e.g. online games without a story), decision #77. */
  Played = 'PLAYED',
  Completed = 'COMPLETED',
}

export const NOTE_MAX_LENGTH = 5000;
export const PLAYTHROUGH_NAME_MAX_LENGTH = 100;
/** Upper bound for any stored minutes value (~16,000 hours): rejects absurd input. */
export const MAX_MINUTES = 1_000_000;
export const RATING_MIN = 10;
export const RATING_MAX = 100;
export const DIFFICULTY_NAME_MAX_LENGTH = 100;
export const ACHIEVEMENT_NAME_MAX_LENGTH = 200;
export const ACHIEVEMENT_DESCRIPTION_MAX_LENGTH = 1000;

/** Initial difficulty list of every UserGame (both playthrough and platinum lists). */
export const DEFAULT_DIFFICULTY_NAMES = ['Muy fácil', 'Fácil', 'Normal', 'Difícil', 'Muy difícil'];

/** Machine-readable error codes; the frontend maps them to user-facing texts. */
export enum LibraryErrorCode {
  UserGameNotFound = 'USER_GAME_NOT_FOUND',
  AchievementNotFound = 'ACHIEVEMENT_NOT_FOUND',
  SteamAchievementReadOnly = 'STEAM_ACHIEVEMENT_READ_ONLY',
  PlaythroughTimeNegative = 'PLAYTHROUGH_TIME_NEGATIVE',
  UserGameAlreadyExists = 'USER_GAME_ALREADY_EXISTS',
  GameNotFound = 'GAME_NOT_FOUND',
  PlatformNotFound = 'PLATFORM_NOT_FOUND',
  PlatformNotAvailable = 'PLATFORM_NOT_AVAILABLE',
  CatalogUnavailable = 'CATALOG_UNAVAILABLE',
  InvalidGameSource = 'INVALID_GAME_SOURCE',
  PlaythroughNotFound = 'PLAYTHROUGH_NOT_FOUND',
  FirstPlaythroughNotDeletable = 'FIRST_PLAYTHROUGH_NOT_DELETABLE',
  CompletionDateNotAllowed = 'COMPLETION_DATE_NOT_ALLOWED',
  CompletionBeforeStart = 'COMPLETION_BEFORE_START',
  DateInFuture = 'DATE_IN_FUTURE',
  DifficultyNotFound = 'DIFFICULTY_NOT_FOUND',
  DifficultyInUse = 'DIFFICULTY_IN_USE',
  DifficultyNameTaken = 'DIFFICULTY_NAME_TAKEN',
  InvalidDifficultyOrder = 'INVALID_DIFFICULTY_ORDER',
  SessionNotFound = 'SESSION_NOT_FOUND',
  PlatinumDateRequired = 'PLATINUM_DATE_REQUIRED',
  PlatinumTimeRequired = 'PLATINUM_TIME_REQUIRED',
  PlatinumBeforeStart = 'PLATINUM_BEFORE_START',
  FavoritesLimitReached = 'FAVORITES_LIMIT_REACHED',
}

/** A curated "top": at most this many favorite games per user (decision #63). */
export const FAVORITES_MAX = 5;
