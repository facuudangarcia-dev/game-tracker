import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { DataSource } from 'typeorm';
import { Game } from '../src/games/game.entity';
import type {
  UserGameDetailsDto,
  UserGameListItemDto,
} from '../src/library/dto/user-game-response.dto';
import { Platform } from '../src/platforms/platform.entity';
import { createTestApp } from './create-test-app';
import type { FakeCatalogProvider } from './fake-catalog-provider';
import { as, registerUser, type TestUser } from './test-users';

describe('Library: UserGame domain (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let catalog: FakeCatalogProvider;
  let resetDatabase: () => Promise<void>;
  let alice: TestUser;
  let bob: TestUser;
  let platformIds: Record<string, string>;

  beforeAll(async () => {
    ({ app, dataSource, catalog, resetDatabase } = await createTestApp());
    const platforms = await dataSource.getRepository(Platform).find();
    platformIds = Object.fromEntries(platforms.map((p) => [p.slug, p.id]));
  });

  beforeEach(async () => {
    await resetDatabase();
    // IGDB platform ids: 48 = PS4, 167 = PS5.
    catalog.add({ externalId: '100', name: 'Fall Guys', platformExternalIds: ['48', '167'] });
    catalog.add({ externalId: '200', name: 'PS5 Exclusive', platformExternalIds: ['167'] });
    alice = await registerUser(app, 'alice@example.com');
    bob = await registerUser(app, 'bob@example.com');
  });

  afterAll(async () => {
    await app.close();
  });

  const addCatalogGame = (user: TestUser, externalId: string, platform: string) =>
    as(app, user).post('/api/library', {
      catalog: { provider: 'igdb', externalId },
      platformId: platformIds[platform],
    });

  async function setPlaythroughs(
    userGameId: string,
    rows: { status: string; start?: string; completion?: string }[],
  ) {
    await dataSource.query('DELETE FROM playthroughs WHERE user_game_id = $1', [userGameId]);
    for (const [index, row] of rows.entries()) {
      await dataSource.query(
        `INSERT INTO playthroughs (user_game_id, number, status, start_date, completion_date)
         VALUES ($1, $2, $3, $4, $5)`,
        [userGameId, index + 1, row.status, row.start ?? null, row.completion ?? null],
      );
    }
  }

  it('requires a session', async () => {
    await request(app.getHttpServer()).get('/api/library').expect(401);
    await request(app.getHttpServer()).post('/api/library').send({}).expect(401);
  });

  describe('POST /api/library', () => {
    it('imports a catalog game and creates the UserGame with playthrough #1', async () => {
      const response = await addCatalogGame(alice, '100', 'ps5').expect(201);
      const body = response.body as UserGameDetailsDto;

      expect(body).toMatchObject({
        game: { name: 'Fall Guys', isManual: false },
        platform: { slug: 'ps5' },
        status: 'PENDING',
        startDate: null,
        completionDate: null,
        totalMinutes: 0,
      });
      expect(body.playthroughs).toEqual([
        expect.objectContaining({
          number: 1,
          name: null,
          status: 'PENDING',
          previousMinutes: 0,
          minutes: 0,
          startDate: null,
          completionDate: null,
        }),
      ]);
    });

    it('allows the same game on different platforms but not twice on the same one', async () => {
      await addCatalogGame(alice, '100', 'ps4').expect(201);
      await addCatalogGame(alice, '100', 'ps5').expect(201);

      const duplicate = await addCatalogGame(alice, '100', 'ps5').expect(409);
      expect(duplicate.body).toMatchObject({ code: 'USER_GAME_ALREADY_EXISTS' });
      // Other users can register the same game and platform.
      await addCatalogGame(bob, '100', 'ps5').expect(201);
    });

    it('reuses an already imported game by gameId', async () => {
      const first = (await addCatalogGame(alice, '100', 'ps4').expect(201))
        .body as UserGameDetailsDto;

      const response = await as(app, bob)
        .post('/api/library', { gameId: first.game.id, platformId: platformIds.ps5 })
        .expect(201);

      expect((response.body as UserGameDetailsDto).game.id).toBe(first.game.id);
      await expect(dataSource.getRepository(Game).count()).resolves.toBe(1);
    });

    it('rejects platforms the catalog does not report for the game', async () => {
      const response = await addCatalogGame(alice, '200', 'ps4').expect(400);

      expect(response.body).toMatchObject({ code: 'PLATFORM_NOT_AVAILABLE' });
      await expect(dataSource.query('SELECT count(*)::int AS n FROM user_games')).resolves.toEqual([
        { n: 0 },
      ]);
    });

    it('creates private manual games on any platform', async () => {
      const response = await as(app, alice)
        .post('/api/library', {
          manualGame: { name: '  My Homebrew  ' },
          platformId: platformIds.gb,
        })
        .expect(201);
      const body = response.body as UserGameDetailsDto;

      expect(body.game).toMatchObject({ name: 'My Homebrew', isManual: true, coverUrl: null });
      expect(body.playthroughs).toHaveLength(1);

      // Bob can neither use nor find Alice's manual game.
      const forBob = await as(app, bob)
        .post('/api/library', { gameId: body.game.id, platformId: platformIds.gb })
        .expect(404);
      expect(forBob.body).toMatchObject({ code: 'GAME_NOT_FOUND' });
      const search = await as(app, bob).get('/api/catalog/search?q=homebrew').expect(200);
      expect((search.body as { results: unknown[] }).results).toEqual([]);
    });

    it.each([
      ['no game source', {}],
      [
        'two game sources',
        { manualGame: { name: 'X' }, catalog: { provider: 'igdb', externalId: '100' } },
      ],
    ])('rejects %s', async (_case, source) => {
      const response = await as(app, alice)
        .post('/api/library', { ...source, platformId: platformIds.ps5 })
        .expect(400);
      expect(response.body).toMatchObject({ code: 'INVALID_GAME_SOURCE' });
    });

    it.each([
      ['an invalid platform id', { manualGame: { name: 'X' }, platformId: 'nope' }],
      ['a blank manual name', { manualGame: { name: '   ' }, platformId: undefined }],
      ['an unknown provider', { catalog: { provider: 'steam', externalId: '1' } }],
    ])('validates %s', async (_case, body) => {
      await as(app, alice)
        .post('/api/library', { platformId: platformIds.ps5, ...body })
        .expect(400);
    });

    it('rejects unknown platforms', async () => {
      const response = await as(app, alice)
        .post('/api/library', {
          manualGame: { name: 'X' },
          platformId: '00000000-0000-4000-8000-000000000000',
        })
        .expect(400);
      expect(response.body).toMatchObject({ code: 'PLATFORM_NOT_FOUND' });
    });

    it('returns 404 for catalog games that do not exist and 503 when the catalog is down', async () => {
      const missing = await addCatalogGame(alice, '999', 'ps5').expect(404);
      expect(missing.body).toMatchObject({ code: 'GAME_NOT_FOUND' });

      catalog.failing = true;
      const down = await addCatalogGame(alice, '100', 'ps5').expect(503);
      expect(down.body).toMatchObject({ code: 'CATALOG_UNAVAILABLE' });
    });
  });

  describe('ownership', () => {
    it('lists only the user’s own games', async () => {
      await addCatalogGame(alice, '100', 'ps5').expect(201);
      await addCatalogGame(bob, '200', 'ps5').expect(201);

      const list = (await as(app, alice).get('/api/library').expect(200))
        .body as UserGameListItemDto[];

      expect(list.map((item) => item.game.name)).toEqual(['Fall Guys']);
    });

    it("returns 404 for another user's UserGame, for reading and deleting", async () => {
      const aliceGame = (await addCatalogGame(alice, '100', 'ps5').expect(201))
        .body as UserGameDetailsDto;

      const read = await as(app, bob).get(`/api/library/${aliceGame.id}`).expect(404);
      expect(read.body).toMatchObject({ code: 'USER_GAME_NOT_FOUND' });
      await as(app, bob).delete(`/api/library/${aliceGame.id}`).expect(404);
      await as(app, alice).get(`/api/library/${aliceGame.id}`).expect(200);
    });

    it('rejects malformed ids with 400', async () => {
      await as(app, alice).get('/api/library/not-a-uuid').expect(400);
    });
  });

  describe('DELETE /api/library/:id', () => {
    it('removes personal data but keeps the Game and the Platform', async () => {
      const created = (await addCatalogGame(alice, '100', 'ps5').expect(201))
        .body as UserGameDetailsDto;

      await as(app, alice).delete(`/api/library/${created.id}`).expect(204);

      await as(app, alice).get(`/api/library/${created.id}`).expect(404);
      await expect(
        dataSource.query('SELECT count(*)::int AS n FROM playthroughs'),
      ).resolves.toEqual([{ n: 0 }]);
      await expect(
        dataSource.getRepository(Game).findOneBy({ id: created.game.id }),
      ).resolves.not.toBeNull();
      await expect(
        dataSource.getRepository(Platform).findOneBy({ id: platformIds.ps5 }),
      ).resolves.not.toBeNull();
    });

    it('keeps a manual game after deleting its UserGame (it stays private to its creator)', async () => {
      const created = (
        await as(app, alice)
          .post('/api/library', { manualGame: { name: 'Homebrew' }, platformId: platformIds.pc })
          .expect(201)
      ).body as UserGameDetailsDto;

      await as(app, alice).delete(`/api/library/${created.id}`).expect(204);

      await expect(
        dataSource.getRepository(Game).findOneBy({ id: created.game.id }),
      ).resolves.not.toBeNull();
    });
  });

  describe('derived status, dates and time', () => {
    let userGameId: string;

    beforeEach(async () => {
      userGameId = (
        (await addCatalogGame(alice, '100', 'ps5').expect(201)).body as UserGameDetailsDto
      ).id;
    });

    const statusOf = async () =>
      (
        (await as(app, alice).get(`/api/library/${userGameId}`).expect(200))
          .body as UserGameDetailsDto
      ).status;

    it.each([
      [['PENDING'], 'PENDING'],
      [['IN_PROGRESS'], 'IN_PROGRESS'],
      [['COMPLETED'], 'COMPLETED'],
      [['COMPLETED', 'PENDING'], 'COMPLETED'],
      [['COMPLETED', 'IN_PROGRESS'], 'IN_PROGRESS'],
      [['COMPLETED', 'COMPLETED'], 'COMPLETED'],
      [['PENDING', 'PENDING'], 'PENDING'],
    ])('playthroughs %j give status %s', async (statuses, expected) => {
      await setPlaythroughs(
        userGameId,
        statuses.map((status) => ({
          status,
          completion: status === 'COMPLETED' ? '2025-01-01' : undefined,
        })),
      );

      await expect(statusOf()).resolves.toBe(expected);
    });

    it('derives start (earliest) and completion (FIRST completion, not the last)', async () => {
      await setPlaythroughs(userGameId, [
        { status: 'COMPLETED', start: '2024-11-02', completion: '2025-03-10' },
        { status: 'COMPLETED', start: '2026-01-05', completion: '2026-02-01' },
        { status: 'PENDING', start: '2024-10-01' },
      ]);

      const body = (await as(app, alice).get(`/api/library/${userGameId}`).expect(200))
        .body as UserGameDetailsDto;

      expect(body.startDate).toBe('2024-10-01');
      expect(body.completionDate).toBe('2025-03-10');
    });

    it('sums the previous time across playthroughs', async () => {
      await setPlaythroughs(userGameId, [{ status: 'PENDING' }, { status: 'PENDING' }]);
      await dataSource.query(
        'UPDATE playthroughs SET previous_time_minutes = number * 60 WHERE user_game_id = $1',
        [userGameId],
      );

      const body = (await as(app, alice).get(`/api/library/${userGameId}`).expect(200))
        .body as UserGameDetailsDto;

      expect(body.totalMinutes).toBe(180);
      expect(body.playthroughs.map((p) => p.minutes)).toEqual([60, 120]);
    });
  });

  describe('database constraints', () => {
    it('enforces unique (user, game, platform) and playthrough rules at the DB level', async () => {
      const created = (await addCatalogGame(alice, '100', 'ps5').expect(201))
        .body as UserGameDetailsDto;

      await expect(
        dataSource.query(
          'INSERT INTO user_games (user_id, game_id, platform_id) VALUES ($1, $2, $3)',
          [alice.id, created.game.id, platformIds.ps5],
        ),
      ).rejects.toThrow(/UQ_user_games_user_game_platform/);
      await expect(
        dataSource.query(
          `UPDATE playthroughs SET completion_date = '2025-01-01' WHERE user_game_id = $1`,
          [created.id],
        ),
      ).rejects.toThrow(/CHK_playthroughs_completion_only_completed/);
      await expect(
        dataSource.query(
          `UPDATE playthroughs SET start_date = '2025-02-01', completion_date = '2025-01-01',
           status = 'COMPLETED' WHERE user_game_id = $1`,
          [created.id],
        ),
      ).rejects.toThrow(/CHK_playthroughs_completion_after_start/);
    });
  });
});
