import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import type { DataSource } from 'typeorm';
import type {
  UserGameDetailsDto,
  UserGameListItemDto,
} from '../src/library/dto/user-game-response.dto';
import { Platform } from '../src/platforms/platform.entity';
import type { SteamPendingGameDto, SteamStatusDto } from '../src/steam/steam.service';
import { SteamService } from '../src/steam/steam.service';
import { createTestApp } from './create-test-app';
import type { FakeCatalogProvider } from './fake-catalog-provider';
import { FAKE_STEAM_ID, type FakeSteamApi } from './fake-steam-api';
import { as, registerUser, type TestUser } from './test-users';

const ORIGIN = 'http://localhost:5173';

describe('Steam: linking, sync and achievements (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let catalog: FakeCatalogProvider;
  let steam: FakeSteamApi;
  let resetDatabase: () => Promise<void>;
  let alice: TestUser;
  let pcId: string;

  beforeAll(async () => {
    ({ app, dataSource, catalog, steam, resetDatabase } = await createTestApp());
    pcId = (await dataSource.getRepository(Platform).findOneByOrFail({ slug: 'pc' })).id;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase();
    alice = await registerUser(app, 'alice@example.com');
    // Portal 2 is in the catalog (on PC); "Tiny Indie" is not.
    catalog.add({ externalId: '72', name: 'Portal 2', platformExternalIds: ['6'] });
    catalog.steamApps.set(620, '72');
    steam.owned = [
      { appId: 620, name: 'Portal 2', minutes: 600 },
      { appId: 999, name: 'Tiny Indie', minutes: 90 },
      { appId: 777, name: 'Tried Once', minutes: 10 },
    ];
    steam.covers.set(999, { data: Buffer.from('fake-jpeg'), contentType: 'image/jpeg' });
  });

  const client = (user: TestUser = alice) => as(app, user);
  const status = async (user: TestUser = alice) =>
    (await client(user).get('/api/steam').expect(200)).body as SteamStatusDto;
  const library = async () =>
    (await client().get('/api/library?sort=name&order=asc').expect(200))
      .body as UserGameListItemDto[];
  const details = async (id: string) =>
    (await client().get(`/api/library/${id}`).expect(200)).body as UserGameDetailsDto;
  const idle = () => app.get(SteamService).whenIdle(alice.id);
  /** Lets the next sync run regardless of the cooldown. */
  const allowSync = () =>
    dataSource.query(`UPDATE steam_accounts SET sync_started_at = now() - interval '1 day'`);
  const sync = async () => {
    await allowSync();
    await client().post('/api/steam/sync', {}).expect(200);
    await idle();
  };

  const pending = async (user: TestUser = alice) =>
    (await client(user).get('/api/steam/pending').expect(200)).body as SteamPendingGameDto[];
  /** Adds the given found games (all of them by default), like the review dialog. */
  const review = async (appIds?: number[], user: TestUser = alice) => {
    const chosen = appIds ?? (await pending(user)).map((game) => game.appId);
    await client(user).post('/api/steam/pending', { appIds: chosen }).expect(200);
    await app.get(SteamService).whenIdle(user.id);
  };

  /**
   * Goes through Steam's login like the browser: link -> Steam -> callback.
   * Then adds every game found, unless `addAll` is false.
   */
  async function linkSteam(user: TestUser = alice, addAll = true): Promise<string> {
    const start = await client(user).get('/api/steam/link').expect(302);
    const steamUrl = new URL(start.headers.location);
    expect(steamUrl.origin).toBe('https://steam.example');
    const returnTo = steamUrl.searchParams.get('returnTo')!;
    expect(returnTo.startsWith(`${ORIGIN}/api/steam/callback?state=`)).toBe(true);
    const callback = new URL(returnTo);
    callback.searchParams.set('openid.return_to', returnTo);
    callback.searchParams.set('openid.claimed_id', 'https://steamcommunity.com/openid/id/x');
    const done = await client(user).get(`/api/steam/callback${callback.search}`).expect(302);
    await app.get(SteamService).whenIdle(user.id);
    if (addAll && (await status(user)).account) {
      await review(undefined, user);
    }
    return done.headers.location;
  }

  describe('linking', () => {
    it('starts unlinked', async () => {
      expect(await status()).toEqual({ configured: true, account: null, excluded: [] });
    });

    it("links through Steam's login and imports the played games", async () => {
      expect(await linkSteam()).toBe(`${ORIGIN}/games?steam=linked`);

      const linked = await status();
      expect(linked.account).toMatchObject({
        personaName: 'Gabe',
        syncing: false,
        syncError: null,
        progress: { done: 2, total: 2 },
      });
      expect(linked.account!.lastSyncedAt).toEqual(expect.any(String));
    });

    it('rejects callbacks without a valid state, of another user or not verified by Steam', async () => {
      const bob = await registerUser(app, 'bob@example.com');
      const start = await client().get('/api/steam/link').expect(302);
      const returnTo = new URL(start.headers.location).searchParams.get('returnTo')!;
      const query = (url: string) => {
        const callback = new URL(url);
        callback.searchParams.set('openid.return_to', url);
        return `/api/steam/callback${callback.search}`;
      };
      const invalid = `${ORIGIN}/games?steam=error&reason=INVALID_LOGIN`;

      expect((await client(bob).get(query(returnTo)).expect(302)).headers.location).toBe(invalid);
      expect(
        (await client().get('/api/steam/callback?state=forged').expect(302)).headers.location,
      ).toBe(invalid);
      steam.loginSteamId = null;
      expect((await client().get(query(returnTo)).expect(302)).headers.location).toBe(invalid);
      expect((await status()).account).toBeNull();
    });

    it('sends visitors without a session to the login', async () => {
      const response = await as(app, { ...alice, cookie: '' })
        .get('/api/steam/callback?state=x')
        .expect(302);
      expect(response.headers.location).toBe(`${ORIGIN}/login`);
      await as(app, { ...alice, cookie: '' })
        .get('/api/steam')
        .expect(401);
    });

    it('links a Steam account to one user only', async () => {
      await linkSteam();
      const bob = await registerUser(app, 'bob@example.com');
      expect(await linkSteam(bob)).toBe(`${ORIGIN}/games?steam=error&reason=STEAM_ACCOUNT_IN_USE`);
    });

    it('is off without STEAM_API_KEY', async () => {
      steam.configured = false;
      expect((await status()).configured).toBe(false);
      const response = await client().get('/api/steam/link').expect(302);
      expect(response.headers.location).toBe(
        `${ORIGIN}/games?steam=error&reason=STEAM_NOT_CONFIGURED`,
      );
    });
  });

  describe('importing games', () => {
    it('adds the games played 1+ hour on PC as played, outside the catalog as manual games', async () => {
      await linkSteam();
      const items = await library();

      expect(items.map((i) => i.game.name)).toEqual(['Portal 2', 'Tiny Indie']);
      expect(items[0]).toMatchObject({
        platform: { slug: 'pc' },
        status: 'PLAYED',
        totalMinutes: 600,
        steam: true,
        game: { isManual: false },
      });
      // Not in the catalog: a manual game with Steam's cover.
      expect(items[1]).toMatchObject({ steam: true, totalMinutes: 90, game: { isManual: true } });
      expect(items[1].game.coverUrl).toEqual(expect.any(String));
    });

    it('offers the games found for review: the chosen ones are added, the rest removed', async () => {
      await linkSteam(alice, false);
      expect(await library()).toEqual([]);
      expect((await status()).account).toMatchObject({ pendingGames: 2 });
      const found = await pending();
      expect(found).toEqual([
        {
          appId: 620,
          name: 'Portal 2',
          minutes: 600,
          coverUrl: expect.any(String),
          manual: false,
          inLibrary: false,
        },
        {
          appId: 999,
          name: 'Tiny Indie',
          minutes: 90,
          coverUrl: expect.stringContaining('/999/'),
          manual: true,
          inLibrary: false,
        },
      ]);

      await review([620]);
      expect((await library()).map((i) => i.game.name)).toEqual(['Portal 2']);
      const after = await status();
      expect(after.account).toMatchObject({ pendingGames: 0, importedGames: 1 });
      expect(after.excluded).toEqual([{ appId: 999, name: 'Tiny Indie' }]);
      expect(await pending()).toEqual([]);
    });

    it('offers a game once it reaches 1 hour, and forgets the offers when unlinking', async () => {
      await linkSteam();
      steam.owned[2].minutes = 75;
      await sync();
      expect((await library()).map((i) => i.game.name)).not.toContain('Tried Once');
      expect((await pending()).map((game) => game.name)).toEqual(['Tried Once']);

      await client().delete('/api/steam').expect(204);
      expect(await pending()).toEqual([]);
    });

    it('validates the choice and needs a linked account', async () => {
      await client()
        .post('/api/steam/pending', { appIds: [620] })
        .expect(404);
      await linkSteam(alice, false);
      await client().post('/api/steam/pending', { appIds: 'all' }).expect(400);
      await client().post('/api/steam/pending', {}).expect(400);
      expect(await pending()).toHaveLength(2);
    });

    it('links the same catalog game already in the library on PC, keeping its time', async () => {
      const existing = (
        await client()
          .post('/api/library', {
            catalog: { provider: 'igdb', externalId: '72' },
            platformId: pcId,
            initialPlaythrough: { status: 'COMPLETED', previousMinutes: 120 },
            rating: 90,
          })
          .expect(201)
      ).body as UserGameDetailsDto;

      await linkSteam(alice, false);
      expect((await pending()).find((game) => game.appId === 620)).toMatchObject({
        inLibrary: true,
      });
      await review();

      const portal = (await library()).filter((i) => i.game.name === 'Portal 2');
      expect(portal).toHaveLength(1);
      expect(portal[0]).toMatchObject({
        id: existing.id,
        steam: true,
        status: 'COMPLETED',
        rating: 90,
        totalMinutes: 720,
      });
    });

    it('reports a private profile', async () => {
      steam.privateProfile = true;
      await linkSteam();
      expect((await status()).account).toMatchObject({ syncError: 'PRIVATE_PROFILE' });
      expect(await library()).toEqual([]);
    });
  });

  describe('hours', () => {
    it("keeps the user's changes on top of Steam's time, with their history", async () => {
      await linkSteam();
      const portal = (await library()).find((i) => i.game.name === 'Portal 2')!;
      const first = (await details(portal.id)).playthroughs[0];
      expect(first).toMatchObject({ steamMinutes: 600, previousMinutes: 0, minutes: 600 });
      const patch = (previousMinutes: number) =>
        client().patch(`/api/library/${portal.id}/playthroughs/${first.id}`, { previousMinutes });

      await patch(-300).expect(200); // -5 h
      await patch(-180).expect(200); // +2 h
      steam.owned[0].minutes = 900; // played 5 h more on Steam
      await sync();

      expect((await details(portal.id)).playthroughs[0]).toMatchObject({
        steamMinutes: 900,
        previousMinutes: -180,
        minutes: 720,
      });
      const history = await dataSource.query<{ delta_minutes: number }[]>(
        'SELECT delta_minutes FROM playthrough_time_adjustments WHERE playthrough_id = $1 ORDER BY created_at',
        [first.id],
      );
      expect(history.map((row) => row.delta_minutes)).toEqual([-300, 120]);

      const negative = await patch(-901).expect(400);
      expect(negative.body).toMatchObject({ code: 'PLAYTHROUGH_TIME_NEGATIVE' });
    });

    it('still rejects negative time on games without Steam', async () => {
      const game = (
        await client()
          .post('/api/library', { manualGame: { name: 'Offline' }, platformId: pcId })
          .expect(201)
      ).body as UserGameDetailsDto;
      await client()
        .patch(`/api/library/${game.id}/playthroughs/${game.playthroughs[0].id}`, {
          previousMinutes: -1,
        })
        .expect(400);
    });
  });

  describe('removed games', () => {
    it('never come back with a sync, until restored', async () => {
      await linkSteam();
      const indie = (await library()).find((i) => i.game.name === 'Tiny Indie')!;
      await client().delete(`/api/library/${indie.id}`).expect(204);

      await sync();
      expect((await library()).map((i) => i.game.name)).toEqual(['Portal 2']);
      expect((await status()).excluded).toEqual([{ appId: 999, name: 'Tiny Indie' }]);

      await client().delete('/api/steam/excluded/999').expect(200);
      await idle();
      expect((await library()).map((i) => i.game.name)).toEqual(['Portal 2', 'Tiny Indie']);
    });
  });

  describe('syncs', () => {
    it('waits 5 minutes between manual syncs and 6 hours between automatic ones', async () => {
      await linkSteam();
      expect(steam.calls.owned).toBe(1);

      const cooldown = await client().post('/api/steam/sync', {}).expect(429);
      expect(cooldown.body).toMatchObject({ code: 'STEAM_SYNC_COOLDOWN' });
      await client().post('/api/steam/sync', { auto: true }).expect(200);
      await idle();
      expect(steam.calls.owned).toBe(1);

      await dataSource.query(
        `UPDATE steam_accounts SET sync_started_at = now() - interval '7 hours'`,
      );
      await client().post('/api/steam/sync', { auto: true }).expect(200);
      await idle();
      expect(steam.calls.owned).toBe(2);
    });

    it('needs a linked account', async () => {
      const response = await client().post('/api/steam/sync', {}).expect(404);
      expect(response.body).toMatchObject({ code: 'STEAM_NOT_LINKED' });
    });

    it('keeps the games after unlinking', async () => {
      await linkSteam();
      expect((await status()).account).toMatchObject({ importedGames: 2 });
      const indie = (await library()).find((i) => i.game.name === 'Tiny Indie')!;
      await client().delete(`/api/library/${indie.id}`).expect(204);
      await client().delete('/api/steam?deleteGames=false').expect(204);
      // The removed games are forgotten.
      expect((await status()).excluded).toEqual([]);
      await linkSteam();
      await client().delete('/api/steam').expect(204);
      expect((await status()).account).toBeNull();
      expect((await library()).every((item) => item.steam)).toBe(true);
      expect(await library()).toHaveLength(2);
      const accounts = await dataSource.query<{ n: number }[]>(
        'SELECT count(*)::int AS n FROM steam_accounts',
      );
      expect(accounts[0].n).toBe(0);
      expect(FAKE_STEAM_ID).toHaveLength(17);
    });

    it("can delete the games Steam added, keeping the user's own without Steam's data", async () => {
      // Portal 2 was already on PC: it stays, without Steam's hours and achievements.
      const existing = (
        await client()
          .post('/api/library', {
            catalog: { provider: 'igdb', externalId: '72' },
            platformId: pcId,
            initialPlaythrough: { status: 'COMPLETED', previousMinutes: 120 },
          })
          .expect(201)
      ).body as UserGameDetailsDto;
      await client()
        .post(`/api/library/${existing.id}/achievements`, { name: 'Sin morir' })
        .expect(201);
      steam.setSchema(620, 'english', [
        {
          apiName: 'ACH_1',
          name: 'Wake Up Call',
          description: null,
          iconUrl: null,
          iconLockedUrl: null,
          hidden: false,
        },
      ]);
      steam.player.set(620, [
        { apiName: 'ACH_1', achieved: true, unlockedAt: new Date('2025-01-01T10:00:00Z') },
      ]);
      await linkSteam();
      expect((await status()).account).toMatchObject({ importedGames: 1 });
      expect((await details(existing.id)).achievementList).toHaveLength(2);
      const first = (await details(existing.id)).playthroughs[0];
      // -4 h on top of Steam's 10 h: without Steam it can't go below zero.
      await client()
        .patch(`/api/library/${existing.id}/playthroughs/${first.id}`, { previousMinutes: -240 })
        .expect(200);

      await client().delete('/api/steam?deleteGames=true').expect(204);

      const items = await library();
      expect(items.map((i) => i.game.name)).toEqual(['Portal 2']);
      expect(items[0]).toMatchObject({ id: existing.id, steam: false, totalMinutes: 0 });
      const portal = await details(existing.id);
      expect(portal.achievementList.map((a) => a.name)).toEqual(['Sin morir']);
      expect(portal.playthroughs[0]).toMatchObject({ steamMinutes: 0, previousMinutes: 0 });
      expect((await status()).account).toBeNull();
    });

    it('rejects an invalid choice', async () => {
      await linkSteam();
      await client().delete('/api/steam?deleteGames=maybe').expect(400);
      expect((await status()).account).not.toBeNull();
    });
  });

  describe('achievements', () => {
    const schema = (names: string[], language: 'english' | 'latam') =>
      names.map((apiName, index) => ({
        apiName,
        name: language === 'english' ? `Achievement ${index + 1}` : `Logro ${index + 1}`,
        description: language === 'english' ? `Do thing ${index + 1}` : `Hacé algo ${index + 1}`,
        iconUrl: `https://cdn.example/${apiName}.jpg`,
        iconLockedUrl: `https://cdn.example/${apiName}_gray.jpg`,
        hidden: index === 2,
      }));

    beforeEach(() => {
      steam.setSchema(620, 'english', schema(['A', 'B', 'C'], 'english'));
      steam.setSchema(620, 'latam', schema(['A', 'B', 'C'], 'latam'));
      steam.player.set(620, [
        { apiName: 'A', achieved: true, unlockedAt: new Date('2025-01-02T10:00:00Z') },
        { apiName: 'B', achieved: false, unlockedAt: null },
        { apiName: 'C', achieved: false, unlockedAt: null },
      ]);
    });

    it('records the import as one event and new unlocks per game in the activity', async () => {
      await linkSteam();
      const activity = async () =>
        (
          (await client().get('/api/activity').expect(200)).body as {
            items: { type: string; game: { name: string } | null; data: object }[];
          }
        ).items.map((item) => [item.type, item.game?.name ?? null, item.data]);
      // Achievements already unlocked when importing aren't news.
      expect(await activity()).toEqual([['STEAM_IMPORT', null, { count: 2 }]]);

      steam.player.set(620, [
        { apiName: 'A', achieved: true, unlockedAt: new Date('2025-01-02T10:00:00Z') },
        { apiName: 'B', achieved: true, unlockedAt: new Date('2025-03-01T10:00:00Z') },
        { apiName: 'C', achieved: false, unlockedAt: null },
      ]);
      steam.owned[0].minutes = 660;
      await sync();
      expect((await activity())[0]).toEqual(['ACHIEVEMENTS', 'Portal 2', { count: 1 }]);
    });

    it("imports Steam's achievements in both languages with the user's progress", async () => {
      await linkSteam();
      const portal = (await library()).find((i) => i.game.name === 'Portal 2')!;
      expect(portal.achievements).toEqual({ achieved: 1, total: 3 });
      expect((await library()).find((i) => i.game.name === 'Tiny Indie')!.achievements).toBeNull();

      const list = (await details(portal.id)).achievementList;
      expect(list.map((a) => [a.name, a.nameEs, a.achieved, a.source, a.hidden])).toEqual([
        ['Achievement 1', 'Logro 1', true, 'STEAM', false],
        ['Achievement 2', 'Logro 2', false, 'STEAM', false],
        ['Achievement 3', 'Logro 3', false, 'STEAM', true],
      ]);
      expect(list[0].achievedAt).toBe('2025-01-02T10:00:00.000Z');
    });

    describe('automatic platinum', () => {
      const unlock = (dates: Record<string, string | null>) =>
        steam.player.set(
          620,
          Object.entries(dates).map(([apiName, date]) => ({
            apiName,
            achieved: date !== null,
            unlockedAt: date ? new Date(date) : null,
          })),
        );
      const portalDetails = async () =>
        details((await library()).find((i) => i.game.name === 'Portal 2')!.id);
      /** Plays a bit more on Steam (so its achievements are synced again) and syncs. */
      const playAndSync = async () => {
        steam.owned[0].minutes += 30;
        await sync();
      };

      it('is added when every Steam achievement gets unlocked on Steam', async () => {
        await linkSteam();
        let portal = await portalDetails();
        expect(portal.platinum.achieved).toBe(false);

        // Checking them by hand doesn't count: only Steam's state does.
        for (const a of portal.achievementList.filter((x) => !x.achieved)) {
          await client()
            .patch(`/api/library/${portal.id}/achievements/${a.id}`, { achieved: true })
            .expect(200);
        }
        await playAndSync();
        expect((await portalDetails()).platinum.achieved).toBe(false);

        unlock({
          A: '2025-01-02T10:00:00Z',
          B: '2025-03-01T10:00:00Z',
          C: '2025-03-05T23:30:00Z',
        });
        await playAndSync();
        portal = await portalDetails();
        expect(portal.platinum).toEqual({
          achieved: true,
          date: '2025-03-05',
          timeMinutes: 660,
          difficulty: null,
        });
        expect(portal.achievementList.every((a) => a.achieved)).toBe(true);
      });

      it('is added on import to games already complete, keeping an existing platinum', async () => {
        unlock({ A: '2025-01-02T10:00:00Z', B: '2025-01-03T10:00:00Z', C: '2025-01-04T10:00:00Z' });
        await linkSteam();
        expect((await portalDetails()).platinum).toMatchObject({
          achieved: true,
          date: '2025-01-04',
          timeMinutes: 600,
        });
      });

      it("isn't added again once removed, until new achievements are completed", async () => {
        unlock({ A: '2025-01-02T10:00:00Z', B: '2025-01-03T10:00:00Z', C: '2025-01-04T10:00:00Z' });
        await linkSteam();
        const id = (await portalDetails()).id;
        await client().put(`/api/library/${id}/platinum`, { achieved: false }).expect(200);
        await playAndSync();
        expect((await portalDetails()).platinum.achieved).toBe(false);

        // A new achievement (e.g. a DLC): incomplete, then completed.
        steam.setSchema(620, 'english', schema(['A', 'B', 'C', 'D'], 'english'));
        steam.setSchema(620, 'latam', schema(['A', 'B', 'C', 'D'], 'latam'));
        // Achievement texts are cached for a day.
        app.get(SteamService).clearCache();
        unlock({
          A: '2025-01-02T10:00:00Z',
          B: '2025-01-03T10:00:00Z',
          C: '2025-01-04T10:00:00Z',
          D: null,
        });
        await playAndSync();
        expect((await portalDetails()).platinum.achieved).toBe(false);
        unlock({
          A: '2025-01-02T10:00:00Z',
          B: '2025-01-03T10:00:00Z',
          C: '2025-01-04T10:00:00Z',
          D: '2025-06-01T10:00:00Z',
        });
        await playAndSync();
        expect((await portalDetails()).platinum).toMatchObject({
          achieved: true,
          date: '2025-06-01',
        });
      });
    });

    it("only checks newly unlocked ones, never undoing the user's changes", async () => {
      await linkSteam();
      const portal = (await library()).find((i) => i.game.name === 'Portal 2')!;
      const [a, b, c] = (await details(portal.id)).achievementList;
      // The user unchecks A (unlocked on Steam) and checks C by hand.
      await client()
        .patch(`/api/library/${portal.id}/achievements/${a.id}`, { achieved: false })
        .expect(200);
      await client()
        .patch(`/api/library/${portal.id}/achievements/${c.id}`, { achieved: true })
        .expect(200);

      steam.player.set(620, [
        { apiName: 'A', achieved: true, unlockedAt: new Date('2025-01-02T10:00:00Z') },
        { apiName: 'B', achieved: true, unlockedAt: new Date('2025-03-01T10:00:00Z') },
        { apiName: 'C', achieved: false, unlockedAt: null },
      ]);
      steam.owned[0].minutes = 660;
      await sync();

      const list = (await details(portal.id)).achievementList;
      expect(list.map((x) => [x.id, x.achieved])).toEqual([
        [a.id, false],
        [b.id, true],
        [c.id, true],
      ]);
    });

    it("lets the user add, edit, check and delete their own, but not Steam's texts", async () => {
      await linkSteam();
      const portal = (await library()).find((i) => i.game.name === 'Portal 2')!;
      const url = `/api/library/${portal.id}/achievements`;

      const created = (
        await client().post(url, { name: '  Speedrun ', description: 'Under 1h' }).expect(201)
      ).body as UserGameDetailsDto;
      const own = created.achievementList[3];
      expect(own).toMatchObject({ source: 'MANUAL', name: 'Speedrun', achieved: false });
      expect(created.achievements).toEqual({ achieved: 1, total: 4 });

      const checked = (
        await client().patch(`${url}/${own.id}`, { achieved: true, name: 'Speedrun!' }).expect(200)
      ).body as UserGameDetailsDto;
      expect(checked.achievementList[3]).toMatchObject({ name: 'Speedrun!', achieved: true });
      expect(checked.achievementList[3].achievedAt).toEqual(expect.any(String));

      const steamOne = created.achievementList[0];
      expect(
        (await client().patch(`${url}/${steamOne.id}`, { name: 'Mine' }).expect(409)).body,
      ).toMatchObject({ code: 'STEAM_ACHIEVEMENT_READ_ONLY' });
      await client().delete(`${url}/${steamOne.id}`).expect(409);

      const removed = (await client().delete(`${url}/${own.id}`).expect(200))
        .body as UserGameDetailsDto;
      expect(removed.achievementList).toHaveLength(3);
      await client().post(url, { name: ' ' }).expect(400);
      await client()
        .patch(`${url}/00000000-0000-0000-0000-000000000000`, { achieved: true })
        .expect(404);
    });

    it('works for games without Steam (manual list)', async () => {
      const game = (
        await client()
          .post('/api/library', {
            manualGame: { name: 'Shadow of the Colossus' },
            platformId: pcId,
          })
          .expect(201)
      ).body as UserGameDetailsDto;
      expect(game.achievementList).toEqual([]);
      expect(game.achievements).toBeNull();
      const body = (
        await client()
          .post(`/api/library/${game.id}/achievements`, { name: 'Defeat Valus' })
          .expect(201)
      ).body as UserGameDetailsDto;
      expect(body.achievements).toEqual({ achieved: 0, total: 1 });
    });

    it("keeps other users' games private", async () => {
      await linkSteam();
      const portal = (await library()).find((i) => i.game.name === 'Portal 2')!;
      const bob = await registerUser(app, 'bob@example.com');
      await client(bob).post(`/api/library/${portal.id}/achievements`, { name: 'x' }).expect(404);
    });
  });
});
