import { SteamPrivateProfileError, SteamUnavailableError } from './steam-api';
import { type FetchFn, STEAM_OPENID_URL, SteamWebApi } from './steam-web-api';

const KEY = 'test-steam-key';
const STEAM_ID = '76561197960287930';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function setup(...responses: Response[]) {
  const fetchMock = jest.fn<Promise<Response>, Parameters<FetchFn>>(() =>
    Promise.resolve(responses.shift() ?? json({})),
  );
  return { api: new SteamWebApi(KEY, fetchMock as FetchFn), fetchMock };
}

describe('SteamWebApi', () => {
  describe('login (OpenID 2.0)', () => {
    const returnTo = 'http://localhost:5173/api/steam/callback?state=abc';
    const callback = (overrides: Record<string, string> = {}) => ({
      state: 'abc',
      'openid.ns': 'http://specs.openid.net/auth/2.0',
      'openid.mode': 'id_res',
      'openid.op_endpoint': STEAM_OPENID_URL,
      'openid.claimed_id': `https://steamcommunity.com/openid/id/${STEAM_ID}`,
      'openid.identity': `https://steamcommunity.com/openid/id/${STEAM_ID}`,
      'openid.return_to': returnTo,
      'openid.response_nonce': '2026-10-11T12:00:00Zxyz',
      'openid.assoc_handle': '1234567890',
      'openid.signed':
        'signed,op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle',
      'openid.sig': 'c2lnbmF0dXJl',
      ...overrides,
    });

    it('builds the login URL to come back to the callback', () => {
      const url = new URL(new SteamWebApi(KEY).loginUrl(returnTo, 'http://localhost:5173'));
      expect(url.origin + url.pathname).toBe(STEAM_OPENID_URL);
      expect(url.searchParams.get('openid.mode')).toBe('checkid_setup');
      expect(url.searchParams.get('openid.return_to')).toBe(returnTo);
      expect(url.searchParams.get('openid.realm')).toBe('http://localhost:5173');
      expect(url.toString()).not.toContain(KEY);
    });

    it('returns the SteamID once Steam confirms the signed response', async () => {
      const { api, fetchMock } = setup(
        new Response('ns:http://specs.openid.net/auth/2.0\nis_valid:true\n'),
      );

      await expect(api.verifyLogin(callback(), returnTo)).resolves.toBe(STEAM_ID);

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(STEAM_OPENID_URL);
      const body = new URLSearchParams(init!.body as string);
      expect(body.get('openid.mode')).toBe('check_authentication');
      expect(body.get('openid.sig')).toBe('c2lnbmF0dXJl');
      expect(body.has('state')).toBe(false);
    });

    it('rejects what Steam does not confirm', async () => {
      const { api } = setup(new Response('ns:http://specs.openid.net/auth/2.0\nis_valid:false\n'));
      await expect(api.verifyLogin(callback(), returnTo)).resolves.toBeNull();
    });

    it.each([
      [{ 'openid.mode': 'cancel' }],
      [{ 'openid.op_endpoint': 'https://evil.example/openid/login' }],
      [{ 'openid.return_to': 'http://evil.example/api/steam/callback?state=abc' }],
      [{ 'openid.claimed_id': 'https://evil.example/openid/id/76561197960287930' }],
      [{ 'openid.identity': 'https://steamcommunity.com/openid/id/76561197960287931' }],
    ])('rejects a forged response %p without asking Steam', async (overrides) => {
      const { api, fetchMock } = setup();
      await expect(api.verifyLogin(callback(overrides), returnTo)).resolves.toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it('reads the owned games with their playtime', async () => {
    const { api, fetchMock } = setup(
      json({
        response: {
          game_count: 3,
          games: [
            { appid: 620, name: 'Portal 2', playtime_forever: 600, img_icon_url: 'x' },
            { appid: 570, name: 'Dota 2', playtime_forever: 0 },
            { appid: 'bad', name: 'Broken', playtime_forever: 5 },
          ],
        },
      }),
    );

    await expect(api.getOwnedGames(STEAM_ID)).resolves.toEqual([
      { appId: 620, name: 'Portal 2', minutes: 600 },
      { appId: 570, name: 'Dota 2', minutes: 0 },
    ]);
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/IPlayerService/GetOwnedGames/v1/');
    expect(url.searchParams.get('steamid')).toBe(STEAM_ID);
    expect(url.searchParams.get('include_played_free_games')).toBe('1');
  });

  it('detects a private profile (an empty response)', async () => {
    const { api } = setup(json({ response: {} }));
    await expect(api.getOwnedGames(STEAM_ID)).rejects.toBeInstanceOf(SteamPrivateProfileError);
  });

  it('reads achievements: none for games without stats, unlock dates for unlocked ones', async () => {
    const { api } = setup(
      json({ playerstats: { error: 'Requested app has no stats', success: false } }, 400),
      json({
        playerstats: {
          success: true,
          achievements: [
            { apiname: 'A', achieved: 1, unlocktime: 1735812000 },
            { apiname: 'B', achieved: 0, unlocktime: 0 },
          ],
        },
      }),
    );

    await expect(api.getPlayerAchievements(STEAM_ID, 1)).resolves.toBeNull();
    await expect(api.getPlayerAchievements(STEAM_ID, 620)).resolves.toEqual([
      { apiName: 'A', achieved: true, unlockedAt: new Date('2025-01-02T10:00:00.000Z') },
      { apiName: 'B', achieved: false, unlockedAt: null },
    ]);
  });

  it('reads the achievement texts of a language, keeping only https icons', async () => {
    const { api, fetchMock } = setup(
      json({
        game: {
          availableGameStats: {
            achievements: [
              {
                name: 'A',
                displayName: 'Primero',
                description: 'Hacé algo',
                hidden: 1,
                icon: 'https://cdn.example/a.jpg',
                icongray: 'http://cdn.example/a_gray.jpg',
              },
            ],
          },
        },
      }),
    );

    await expect(api.getAchievementSchema(620, 'latam')).resolves.toEqual([
      {
        apiName: 'A',
        name: 'Primero',
        description: 'Hacé algo',
        iconUrl: 'https://cdn.example/a.jpg',
        iconLockedUrl: null,
        hidden: true,
      },
    ]);
    expect(new URL(fetchMock.mock.calls[0][0] as string).searchParams.get('l')).toBe('latam');
  });

  it('never puts the key in errors', async () => {
    const { api } = setup(json({}, 500));
    const error = (await api.getOwnedGames(STEAM_ID).catch((e: unknown) => e)) as Error;
    expect(error).toBeInstanceOf(SteamUnavailableError);
    expect(error.message).not.toContain(KEY);
    expect(error.message).toContain('GetOwnedGames');
  });

  it('is off without a key', async () => {
    const api = new SteamWebApi(null);
    expect(api.isConfigured).toBe(false);
    await expect(api.getOwnedGames(STEAM_ID)).rejects.toBeInstanceOf(SteamUnavailableError);
  });
});
