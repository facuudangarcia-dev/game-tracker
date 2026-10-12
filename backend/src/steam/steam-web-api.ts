import { steamCoverUrl } from './steam.constants';
import {
  type SteamAchievementSchema,
  type SteamApi,
  type SteamImage,
  type SteamLanguage,
  type SteamOwnedGame,
  type SteamPlayerAchievement,
  SteamPrivateProfileError,
  SteamUnavailableError,
} from './steam-api';

export type FetchFn = typeof fetch;

export const STEAM_API_URL = 'https://api.steampowered.com';
export const STEAM_OPENID_URL = 'https://steamcommunity.com/openid/login';
const OPENID_NS = 'http://specs.openid.net/auth/2.0';
const OPENID_IDENTIFIER_SELECT = 'http://specs.openid.net/auth/2.0/identifier_select';
const CLAIMED_ID_PATTERN = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Steam Web API (https://steamcommunity.com/dev) and Steam's OpenID 2.0 login.
 * The key goes in the query string, as Steam requires: URLs are never logged
 * nor put in error messages (only the method name).
 */
export class SteamWebApi implements SteamApi {
  constructor(
    private readonly apiKey: string | null,
    private readonly fetchFn: FetchFn = fetch,
  ) {}

  get isConfigured(): boolean {
    return this.apiKey !== null;
  }

  loginUrl(returnTo: string, realm: string): string {
    const params = new URLSearchParams({
      'openid.ns': OPENID_NS,
      'openid.mode': 'checkid_setup',
      'openid.return_to': returnTo,
      'openid.realm': realm,
      'openid.identity': OPENID_IDENTIFIER_SELECT,
      'openid.claimed_id': OPENID_IDENTIFIER_SELECT,
    });
    return `${STEAM_OPENID_URL}?${params.toString()}`;
  }

  async verifyLogin(params: Record<string, string>, returnTo: string): Promise<string | null> {
    const claimed = CLAIMED_ID_PATTERN.exec(params['openid.claimed_id'] ?? '');
    if (
      params['openid.mode'] !== 'id_res' ||
      params['openid.op_endpoint'] !== STEAM_OPENID_URL ||
      params['openid.return_to'] !== returnTo ||
      params['openid.identity'] !== params['openid.claimed_id'] ||
      !claimed
    ) {
      return null;
    }
    // Steam confirms the signed response (stateless verification).
    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (key.startsWith('openid.')) {
        body.set(key, value);
      }
    }
    body.set('openid.mode', 'check_authentication');
    let response: Response;
    try {
      response = await this.fetchFn(STEAM_OPENID_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new SteamUnavailableError('Steam login verification failed');
    }
    if (!response.ok) {
      throw new SteamUnavailableError(`Steam login verification failed (${response.status})`);
    }
    const text = await response.text();
    return /(^|\n)is_valid:true(\n|$)/.test(text) ? claimed[1] : null;
  }

  async getPersonaName(steamId: string): Promise<string | null> {
    const body = await this.get('ISteamUser/GetPlayerSummaries/v2', { steamids: steamId });
    const players = (body as { response?: { players?: unknown[] } }).response?.players;
    const player = Array.isArray(players) ? (players[0] as { personaname?: unknown }) : null;
    return typeof player?.personaname === 'string' ? player.personaname.slice(0, 100) : null;
  }

  async getOwnedGames(steamId: string): Promise<SteamOwnedGame[]> {
    const body = await this.get('IPlayerService/GetOwnedGames/v1', {
      steamid: steamId,
      include_appinfo: '1',
      include_played_free_games: '1',
    });
    const response = (body as { response?: { game_count?: unknown; games?: unknown } }).response;
    // A private profile answers with an empty response (no game count).
    if (!response || typeof response.game_count !== 'number') {
      throw new SteamPrivateProfileError();
    }
    const games = Array.isArray(response.games) ? response.games : [];
    return games.flatMap((entry): SteamOwnedGame[] => {
      const game = entry as { appid?: unknown; name?: unknown; playtime_forever?: unknown };
      if (
        !isPositiveInt(game.appid) ||
        typeof game.name !== 'string' ||
        !isNonNegativeInt(game.playtime_forever)
      ) {
        return [];
      }
      return [{ appId: game.appid, name: game.name.slice(0, 200), minutes: game.playtime_forever }];
    });
  }

  async getPlayerAchievements(
    steamId: string,
    appId: number,
  ): Promise<SteamPlayerAchievement[] | null> {
    const body = await this.get(
      'ISteamUserStats/GetPlayerAchievements/v1',
      { steamid: steamId, appid: String(appId) },
      // Games without achievements answer 400 ("Requested app has no stats").
      [400],
    );
    const stats = (body as { playerstats?: { success?: unknown; achievements?: unknown } })
      .playerstats;
    if (!stats || stats.success !== true || !Array.isArray(stats.achievements)) {
      return null;
    }
    return stats.achievements.flatMap((entry): SteamPlayerAchievement[] => {
      const item = entry as { apiname?: unknown; achieved?: unknown; unlocktime?: unknown };
      if (typeof item.apiname !== 'string') {
        return [];
      }
      const achieved = item.achieved === 1;
      const unlocked = isPositiveInt(item.unlocktime) ? new Date(item.unlocktime * 1000) : null;
      return [{ apiName: item.apiname, achieved, unlockedAt: achieved ? unlocked : null }];
    });
  }

  async getAchievementSchema(
    appId: number,
    language: SteamLanguage,
  ): Promise<SteamAchievementSchema[]> {
    const body = await this.get('ISteamUserStats/GetSchemaForGame/v2', {
      appid: String(appId),
      l: language,
    });
    const achievements = (body as { game?: { availableGameStats?: { achievements?: unknown } } })
      .game?.availableGameStats?.achievements;
    if (!Array.isArray(achievements)) {
      return [];
    }
    return achievements.flatMap((entry): SteamAchievementSchema[] => {
      const item = entry as {
        name?: unknown;
        displayName?: unknown;
        description?: unknown;
        icon?: unknown;
        icongray?: unknown;
        hidden?: unknown;
      };
      if (typeof item.name !== 'string' || typeof item.displayName !== 'string') {
        return [];
      }
      return [
        {
          apiName: item.name,
          name: item.displayName.slice(0, 200) || item.name.slice(0, 200),
          description:
            typeof item.description === 'string' && item.description.trim()
              ? item.description.slice(0, 1000)
              : null,
          iconUrl: httpsUrl(item.icon),
          iconLockedUrl: httpsUrl(item.icongray),
          hidden: item.hidden === 1,
        },
      ];
    });
  }

  async fetchCover(appId: number): Promise<SteamImage | null> {
    let response: Response;
    try {
      response = await this.fetchFn(steamCoverUrl(appId), {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      return null;
    }
    const contentType = response.headers.get('content-type') ?? '';
    if (!response.ok || !contentType.startsWith('image/')) {
      return null;
    }
    const data = Buffer.from(await response.arrayBuffer());
    if (data.length === 0 || data.length > MAX_IMAGE_BYTES) {
      return null;
    }
    return { data, contentType: contentType.split(';')[0] };
  }

  private async get(
    method: string,
    query: Record<string, string>,
    acceptedErrors: number[] = [],
  ): Promise<unknown> {
    if (!this.apiKey) {
      throw new SteamUnavailableError('Steam is not configured (STEAM_API_KEY)');
    }
    const params = new URLSearchParams({ key: this.apiKey, format: 'json', ...query });
    let response: Response;
    try {
      response = await this.fetchFn(`${STEAM_API_URL}/${method}/?${params.toString()}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      const reason =
        error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'network';
      throw new SteamUnavailableError(`Steam request ${method} failed (${reason})`);
    }
    if (response.status === 403 && method.includes('GetPlayerAchievements')) {
      throw new SteamPrivateProfileError();
    }
    if (!response.ok && !acceptedErrors.includes(response.status)) {
      throw new SteamUnavailableError(`Steam request ${method} failed (${response.status})`);
    }
    try {
      return await response.json();
    } catch {
      throw new SteamUnavailableError(`Steam response of ${method} is not JSON`);
    }
  }
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isNonNegativeInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function httpsUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2000) {
    return null;
  }
  try {
    return new URL(value).protocol === 'https:' ? value : null;
  } catch {
    return null;
  }
}
