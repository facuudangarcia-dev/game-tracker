/** A game of the user's Steam account with their playtime. */
export interface SteamOwnedGame {
  appId: number;
  name: string;
  /** Total playtime according to Steam, in minutes. */
  minutes: number;
}

/** The user's state of one achievement of a game. */
export interface SteamPlayerAchievement {
  apiName: string;
  achieved: boolean;
  unlockedAt: Date | null;
}

/** An achievement of a game, in one language. */
export interface SteamAchievementSchema {
  apiName: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
  iconLockedUrl: string | null;
  hidden: boolean;
}

/** Steam languages used for achievement texts (decision #78). */
export type SteamLanguage = 'english' | 'latam';

export interface SteamImage {
  data: Buffer;
  contentType: string;
}

/** Steam can't be reached or answered with an error. */
export class SteamUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SteamUnavailableError';
  }
}

/** The account's game details are private: Steam returns no games. */
export class SteamPrivateProfileError extends Error {
  constructor() {
    super('The Steam profile game details are private');
    this.name = 'SteamPrivateProfileError';
  }
}

/**
 * Steam Web API and Steam's OpenID login (decision #78). Implementations never
 * log nor expose the API key.
 */
export interface SteamApi {
  readonly isConfigured: boolean;
  /** URL of Steam's login page that comes back to `returnTo`. */
  loginUrl(returnTo: string, realm: string): string;
  /** Checks with Steam a login callback; returns the SteamID64 or null if invalid. */
  verifyLogin(params: Record<string, string>, returnTo: string): Promise<string | null>;
  getPersonaName(steamId: string): Promise<string | null>;
  /** All games of the account, including played free games. */
  getOwnedGames(steamId: string): Promise<SteamOwnedGame[]>;
  /** The user's achievements of a game; null when the game has none. */
  getPlayerAchievements(steamId: string, appId: number): Promise<SteamPlayerAchievement[] | null>;
  getAchievementSchema(appId: number, language: SteamLanguage): Promise<SteamAchievementSchema[]>;
  /** Vertical cover (library capsule) of a game, if Steam has one. */
  fetchCover(appId: number): Promise<SteamImage | null>;
}

export const STEAM_API = Symbol('STEAM_API');
