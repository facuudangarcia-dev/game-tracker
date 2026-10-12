import {
  type SteamAchievementSchema,
  type SteamApi,
  type SteamImage,
  type SteamLanguage,
  type SteamOwnedGame,
  type SteamPlayerAchievement,
  SteamPrivateProfileError,
  SteamUnavailableError,
} from '../src/steam/steam-api';

export const FAKE_STEAM_ID = '76561197960287930';

/** In-memory Steam: e2e tests never call Steam. */
export class FakeSteamApi implements SteamApi {
  configured = true;
  failing = false;
  privateProfile = false;
  personaName: string | null = 'Gabe';
  /** SteamID the next login callback verifies to (null: an invalid login). */
  loginSteamId: string | null = FAKE_STEAM_ID;
  owned: SteamOwnedGame[] = [];
  player = new Map<number, SteamPlayerAchievement[] | null>();
  schemas = new Map<string, SteamAchievementSchema[]>();
  covers = new Map<number, SteamImage>();
  calls = { owned: 0, player: 0, schema: 0 };

  get isConfigured(): boolean {
    return this.configured;
  }

  reset(): void {
    this.configured = true;
    this.failing = false;
    this.privateProfile = false;
    this.personaName = 'Gabe';
    this.loginSteamId = FAKE_STEAM_ID;
    this.owned = [];
    this.player = new Map();
    this.schemas = new Map();
    this.covers = new Map();
    this.calls = { owned: 0, player: 0, schema: 0 };
  }

  setSchema(appId: number, language: SteamLanguage, schema: SteamAchievementSchema[]): void {
    this.schemas.set(`${appId}:${language}`, schema);
  }

  loginUrl(returnTo: string, realm: string): string {
    return `https://steam.example/login?${new URLSearchParams({ returnTo, realm }).toString()}`;
  }

  verifyLogin(params: Record<string, string>, returnTo: string): Promise<string | null> {
    this.throwIfFailing();
    return Promise.resolve(params['openid.return_to'] === returnTo ? this.loginSteamId : null);
  }

  getPersonaName(): Promise<string | null> {
    this.throwIfFailing();
    return Promise.resolve(this.personaName);
  }

  getOwnedGames(): Promise<SteamOwnedGame[]> {
    this.calls.owned++;
    this.throwIfFailing();
    if (this.privateProfile) {
      return Promise.reject(new SteamPrivateProfileError());
    }
    return Promise.resolve(this.owned.map((game) => ({ ...game })));
  }

  getPlayerAchievements(_steamId: string, appId: number) {
    this.calls.player++;
    this.throwIfFailing();
    return Promise.resolve(this.player.get(appId) ?? null);
  }

  getAchievementSchema(appId: number, language: SteamLanguage) {
    this.calls.schema++;
    this.throwIfFailing();
    return Promise.resolve(this.schemas.get(`${appId}:${language}`) ?? []);
  }

  fetchCover(appId: number): Promise<SteamImage | null> {
    return Promise.resolve(this.covers.get(appId) ?? null);
  }

  private throwIfFailing(): void {
    if (this.failing) {
      throw new SteamUnavailableError('Steam is down (fake)');
    }
  }
}
