import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { DataSource } from 'typeorm';
import { CatalogDetailsService, type CatalogGameDto } from '../src/catalog/catalog-details.service';
import { Game } from '../src/games/game.entity';
import { Genre } from '../src/genres/genre.entity';
import { DifficultyKind } from '../src/library/difficulty.entity';
import type { UserGameDetailsDto } from '../src/library/dto/user-game-response.dto';
import { Platform } from '../src/platforms/platform.entity';
import { createTestApp } from './create-test-app';
import type { FakeCatalogProvider } from './fake-catalog-provider';
import { as, registerUser, type TestUser } from './test-users';

describe('Catalog exploration and configured add (e2e)', () => {
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
    // IGDB ids: 48 PS4, 167 PS5, 6 Windows (PC); 999999 unknown platform.
    catalog.add({
      externalId: '1001',
      name: "Marvel's Spider-Man",
      summary: 'Be Spider-Man.',
      releaseDate: '2018-09-07',
      coverRef: 'cospidey',
      artworkRef: 'arspidey',
      platformExternalIds: ['48', '167', '6', '999999'],
      genres: [
        { externalId: '31', name: 'Adventure' },
        { externalId: '4242', name: 'Superhero' },
      ],
      developers: ['Insomniac Games'],
      publishers: ['Sony Interactive Entertainment'],
    });
    alice = await registerUser(app, 'alice@example.com');
    bob = await registerUser(app, 'bob@example.com');
  });

  afterAll(async () => {
    await app.close();
  });

  const getCatalogGame = (user: TestUser, externalId = '1001', provider = 'igdb') =>
    as(app, user).get(`/api/catalog/games/${provider}/${externalId}`);
  const addSpiderMan = (user: TestUser, platform: string, extra: object = {}) =>
    as(app, user).post('/api/library', {
      catalog: { provider: 'igdb', externalId: '1001' },
      platformId: platformIds[platform],
      ...extra,
    });

  describe('GET /api/catalog/games/:provider/:externalId', () => {
    it('requires a session', async () => {
      await request(app.getHttpServer()).get('/api/catalog/games/igdb/1001').expect(401);
    });

    it('shows a not-yet-imported game from the provider without storing anything', async () => {
      const body = (await getCatalogGame(alice).expect(200)).body as CatalogGameDto;

      expect(body).toEqual({
        gameId: null,
        provider: 'igdb',
        externalId: '1001',
        name: "Marvel's Spider-Man",
        summary: 'Be Spider-Man.',
        releaseDate: '2018-09-07',
        coverUrl: '/api/catalog/igdb/images/cospidey?size=cover',
        artworkUrl: '/api/catalog/igdb/images/arspidey?size=artwork',
        platforms: [
          expect.objectContaining({ slug: 'ps5' }),
          expect.objectContaining({ slug: 'ps4' }),
          expect.objectContaining({ slug: 'pc' }),
        ],
        genres: [
          { id: expect.any(String), slug: 'adventure', name: 'Aventura' },
          { id: null, slug: null, name: 'Superhero' },
        ],
        developers: ['Insomniac Games'],
        publishers: ['Sony Interactive Entertainment'],
        libraryEntries: [],
      });
      await expect(dataSource.getRepository(Game).count()).resolves.toBe(0);
      await expect(dataSource.getRepository(Genre).countBy({ name: 'Superhero' })).resolves.toBe(0);
    });

    it('caches provider details', async () => {
      await getCatalogGame(alice).expect(200);
      await getCatalogGame(alice).expect(200);
      expect(catalog.calls.getGame).toBe(1);
    });

    it('serves imported games from the database, even with the provider down', async () => {
      await addSpiderMan(alice, 'ps5').expect(201);
      app.get(CatalogDetailsService).clearCache();
      catalog.failing = true;

      const body = (await getCatalogGame(alice).expect(200)).body as CatalogGameDto;

      expect(body.gameId).toEqual(expect.any(String));
      expect(body.coverUrl).toMatch(/^\/api\/assets\/covers\//);
      expect(body.genres.map((g) => g.name)).toEqual(['Aventura', 'Superhero']);
      // The artwork is decorative: without the provider there is simply none.
      expect(body.artworkUrl).toBeNull();
    });

    it('takes the artwork of an imported game from the provider', async () => {
      await addSpiderMan(alice, 'ps5').expect(201);

      const body = (await getCatalogGame(alice).expect(200)).body as CatalogGameDto;

      expect(body.gameId).toEqual(expect.any(String));
      expect(body.artworkUrl).toBe('/api/catalog/igdb/images/arspidey?size=artwork');
    });

    it("lists only the current user's library entries for the game", async () => {
      const added = (await addSpiderMan(alice, 'ps5').expect(201)).body as UserGameDetailsDto;
      await addSpiderMan(bob, 'ps4').expect(201);

      const forAlice = (await getCatalogGame(alice).expect(200)).body as CatalogGameDto;
      expect(forAlice.libraryEntries).toEqual([
        { userGameId: added.id, platform: expect.objectContaining({ slug: 'ps5' }) },
      ]);
    });

    it('returns 404 for unknown games or providers, and 503 when the provider is down', async () => {
      const missing = await getCatalogGame(alice, '424242').expect(404);
      expect(missing.body).toMatchObject({ code: 'CATALOG_GAME_NOT_FOUND' });
      await getCatalogGame(alice, '1001', 'steam').expect(404);

      catalog.failing = true;
      const down = await getCatalogGame(alice, '2002').expect(503);
      expect(down.body).toMatchObject({ code: 'CATALOG_UNAVAILABLE' });
    });

    it("can never reach a manual game (another user's or one's own)", async () => {
      const manual = (
        await as(app, alice)
          .post('/api/library', { manualGame: { name: 'Secret' }, platformId: platformIds.pc })
          .expect(201)
      ).body as UserGameDetailsDto;

      await getCatalogGame(bob, manual.game.id).expect(404);
      await getCatalogGame(alice, manual.game.id).expect(404);
    });
  });

  describe('image proxy sizes', () => {
    it('serves the larger cover variant on request and validates the size', async () => {
      await as(app, alice).get('/api/catalog/igdb/images/cospidey?size=cover').expect(200);
      await as(app, alice).get('/api/catalog/igdb/images/cospidey').expect(200);
      await as(app, alice).get('/api/catalog/igdb/images/cospidey?size=huge').expect(400);

      expect(catalog.imageVariants).toEqual(['cover', 'thumbnail']);
    });
  });

  describe('adding with initial settings', () => {
    it('applies status, dates, difficulty and rating to the new UserGame and playthrough #1', async () => {
      const body = (
        await addSpiderMan(alice, 'ps4', {
          initialPlaythrough: {
            status: 'IN_PROGRESS',
            startDate: '2026-01-10',
            difficulty: 'Difícil',
          },
          rating: 87,
        }).expect(201)
      ).body as UserGameDetailsDto;

      expect(body).toMatchObject({ status: 'IN_PROGRESS', rating: 87, startDate: '2026-01-10' });
      expect(body.playthroughs).toEqual([
        expect.objectContaining({
          number: 1,
          status: 'IN_PROGRESS',
          startDate: '2026-01-10',
          difficulty: { id: expect.any(String), name: 'Difícil' },
          timeMode: 'MANUAL',
        }),
      ]);
      expect(
        body.difficulties.find((d) => d.name === 'Difícil' && d.kind === DifficultyKind.Playthrough)
          ?.inUse,
      ).toBe(true);
    });

    it('can add a game already completed', async () => {
      const body = (
        await addSpiderMan(alice, 'ps4', {
          initialPlaythrough: {
            status: 'COMPLETED',
            startDate: '2025-01-01',
            completionDate: '2025-02-01',
          },
        }).expect(201)
      ).body as UserGameDetailsDto;
      expect(body).toMatchObject({ status: 'COMPLETED', completionDate: '2025-02-01' });
    });

    it.each([
      [{ initialPlaythrough: { status: 'COMPLETED' } }, 'COMPLETION_DATE_REQUIRED'],
      [
        { initialPlaythrough: { status: 'PENDING', completionDate: '2025-01-01' } },
        'COMPLETION_DATE_NOT_ALLOWED',
      ],
      [{ initialPlaythrough: { difficulty: 'Pesadilla' } }, undefined],
      [{ rating: 101 }, undefined],
      [{ rating: 50.5 }, undefined],
    ])('rejects %j without importing or creating anything', async (extra, code) => {
      const response = await addSpiderMan(alice, 'ps4', extra).expect(400);

      expect(response.body).toMatchObject(code ? { code } : {});
      await expect(dataSource.getRepository(Game).count()).resolves.toBe(0);
      await expect(dataSource.query('SELECT count(*)::int AS n FROM user_games')).resolves.toEqual([
        { n: 0 },
      ]);
    });

    it('allows another platform as a separate UserGame but never a duplicate', async () => {
      const ps5 = (await addSpiderMan(alice, 'ps5').expect(201)).body as UserGameDetailsDto;
      const ps4 = (await addSpiderMan(alice, 'ps4').expect(201)).body as UserGameDetailsDto;
      expect(ps4.id).not.toBe(ps5.id);
      expect(ps4.game.id).toBe(ps5.game.id);

      const duplicate = await addSpiderMan(alice, 'ps5', { rating: 90 }).expect(409);
      expect(duplicate.body).toMatchObject({ code: 'USER_GAME_ALREADY_EXISTS' });

      const entries = ((await getCatalogGame(alice).expect(200)).body as CatalogGameDto)
        .libraryEntries;
      expect(entries.map((e) => e.platform.slug)).toEqual(['ps5', 'ps4']);
    });

    it('rejects platforms the catalog does not report', async () => {
      const response = await addSpiderMan(alice, 'switch').expect(400);
      expect(response.body).toMatchObject({ code: 'PLATFORM_NOT_AVAILABLE' });
    });
  });
});
