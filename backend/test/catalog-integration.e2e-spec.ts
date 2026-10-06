import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { DataSource, Repository } from 'typeorm';
import {
  CatalogGameNotFoundError,
  CatalogImportService,
} from '../src/catalog/catalog-import.service';
import { CatalogProvider } from '../src/catalog/catalog-provider';
import type { CatalogSearchResponseDto } from '../src/catalog/catalog-search.service';
import { CatalogUnavailableError } from '../src/catalog/game-catalog-provider';
import { Game } from '../src/games/game.entity';
import { User } from '../src/users/user.entity';
import { createTestApp } from './create-test-app';
import { FAKE_JPEG, type FakeCatalogProvider } from './fake-catalog-provider';

const IGDB = CatalogProvider.Igdb;

describe('Catalog integration: search, import and covers (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let catalog: FakeCatalogProvider;
  let resetDatabase: () => Promise<void>;
  let games: Repository<Game>;
  let importer: CatalogImportService;

  beforeAll(async () => {
    ({ app, dataSource, catalog, resetDatabase } = await createTestApp());
    games = dataSource.getRepository(Game);
    importer = app.get(CatalogImportService);
  });

  beforeEach(async () => {
    await resetDatabase();
    catalog.add({
      externalId: '1942',
      name: 'The Witcher 3: Wild Hunt',
      slug: 'the-witcher-3-wild-hunt',
      summary: 'Geralt of Rivia...',
      releaseDate: '2015-05-19',
      coverRef: 'co1wyy',
      // PS4, Windows, Mac (both → PC) and an IGDB platform we don't have.
      platformExternalIds: ['48', '6', '14', '999999'],
      genres: [
        { externalId: '12', name: 'Role-playing (RPG)' },
        { externalId: '777', name: 'Brand New Genre' },
      ],
      developers: ['CD Projekt RED'],
      publishers: ['CD Projekt', 'Bandai Namco'],
    });
    catalog.add({ externalId: '2000', name: 'The Witcher 2', platformExternalIds: ['12'] });
  });

  afterAll(async () => {
    await app.close();
  });

  async function login(email = 'player@example.com'): Promise<{ cookie: string; user: User }> {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'super-secret-1' })
      .expect(201);
    const cookie = (response.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
    return { cookie, user: await dataSource.getRepository(User).findOneByOrFail({ email }) };
  }

  async function search(cookie: string, q: string): Promise<CatalogSearchResponseDto> {
    const response = await request(app.getHttpServer())
      .get('/api/catalog/search')
      .query({ q })
      .set('Cookie', cookie)
      .expect(200);
    return response.body as CatalogSearchResponseDto;
  }

  describe('GET /api/catalog/search', () => {
    it('requires a session', async () => {
      await request(app.getHttpServer()).get('/api/catalog/search?q=witcher').expect(401);
    });

    it.each([[''], ['a'], ['x'.repeat(101)]])('rejects query %p with 400', async (q) => {
      const { cookie } = await login();
      await request(app.getHttpServer())
        .get('/api/catalog/search')
        .query({ q })
        .set('Cookie', cookie)
        .expect(400);
    });

    it('returns provider results with known platforms and proxied thumbnails', async () => {
      const { cookie } = await login();

      const body = await search(cookie, 'witcher 3');

      expect(body.catalogAvailable).toBe(true);
      expect(body.results).toEqual([
        {
          gameId: null,
          provider: 'igdb',
          externalId: '1942',
          name: 'The Witcher 3: Wild Hunt',
          releaseDate: '2015-05-19',
          coverUrl: '/api/catalog/igdb/images/co1wyy',
          platforms: [
            expect.objectContaining({ slug: 'ps4' }),
            expect.objectContaining({ slug: 'pc' }),
          ],
          isManual: false,
        },
      ]);
    });

    it('marks already imported games and serves their stored cover', async () => {
      const { cookie } = await login();
      const imported = await importer.importGame(IGDB, '1942');

      const body = await search(cookie, 'witcher');

      const witcher3 = body.results.filter((r) => r.externalId === '1942');
      expect(witcher3).toHaveLength(1);
      expect(witcher3[0]).toMatchObject({
        gameId: imported.id,
        coverUrl: `/api/assets/${imported.coverAssetKey}`,
      });
    });

    it("includes the user's own manual games but not other users' ones", async () => {
      const alice = await login('alice@example.com');
      const bob = await login('bob@example.com');
      await games.save([
        games.create({ name: 'Witcher fan game', createdByUserId: alice.user.id }),
        games.create({ name: 'Witcher secret', createdByUserId: bob.user.id }),
      ]);

      const names = (await search(alice.cookie, 'witcher')).results.map((r) => r.name);

      expect(names).toContain('Witcher fan game');
      expect(names).not.toContain('Witcher secret');
      const manual = (await search(alice.cookie, 'fan game')).results[0];
      expect(manual).toMatchObject({ isManual: true, provider: null, externalId: null });
    });

    it('falls back to local results when the provider is down', async () => {
      const { cookie, user } = await login();
      await importer.importGame(IGDB, '1942');
      await games.save(games.create({ name: 'Witcher homebrew', createdByUserId: user.id }));
      catalog.failing = true;

      const body = await search(cookie, 'witcher');

      expect(body.catalogAvailable).toBe(false);
      expect(body.results.map((r) => r.name).sort()).toEqual([
        'The Witcher 3: Wild Hunt',
        'Witcher homebrew',
      ]);
    });

    it('treats LIKE wildcards in the query literally', async () => {
      const { cookie, user } = await login();
      await games.save(games.create({ name: 'Zelda', createdByUserId: user.id }));

      expect((await search(cookie, '%a')).results).toEqual([]);
    });

    it('caches provider searches', async () => {
      const { cookie } = await login();

      await search(cookie, 'witcher');
      await search(cookie, '  Witcher ');

      expect(catalog.calls.search).toBe(1);
    });
  });

  describe('GET /api/catalog/:provider/images/:ref (thumbnail proxy)', () => {
    it('streams the provider image without storing it', async () => {
      const { cookie } = await login();

      const response = await request(app.getHttpServer())
        .get('/api/catalog/igdb/images/co1wyy')
        .set('Cookie', cookie)
        .expect(200)
        .expect('Content-Type', 'image/jpeg');

      expect(Buffer.from(response.body as Buffer)).toEqual(FAKE_JPEG);
      expect(response.headers['cache-control']).toBe('private, max-age=86400');
    });

    it('requires a session', async () => {
      await request(app.getHttpServer()).get('/api/catalog/igdb/images/co1wyy').expect(401);
    });

    it('returns 404 for unknown providers or invalid references', async () => {
      const { cookie } = await login();
      await request(app.getHttpServer())
        .get('/api/catalog/other/images/co1wyy')
        .set('Cookie', cookie)
        .expect(404);
      await request(app.getHttpServer())
        .get('/api/catalog/igdb/images/BAD..ref')
        .set('Cookie', cookie)
        .expect(404);
    });

    it('returns 503 when the provider image is unavailable', async () => {
      const { cookie } = await login();
      catalog.failingImages = true;

      const response = await request(app.getHttpServer())
        .get('/api/catalog/igdb/images/co1wyy')
        .set('Cookie', cookie)
        .expect(503);
      expect(response.body).toMatchObject({ code: 'CATALOG_UNAVAILABLE' });
    });
  });

  describe('CatalogImportService.importGame', () => {
    it('imports catalog data, platforms, genres and the cover', async () => {
      const game = await importer.importGame(IGDB, '1942');

      expect(game).toMatchObject({
        provider: 'igdb',
        externalId: '1942',
        createdByUserId: null,
        name: 'The Witcher 3: Wild Hunt',
        slug: 'the-witcher-3-wild-hunt',
        summary: 'Geralt of Rivia...',
        releaseDate: '2015-05-19',
        developers: ['CD Projekt RED'],
        publishers: ['CD Projekt', 'Bandai Namco'],
      });
      // Windows + Mac collapse into PC; the unknown platform is dropped.
      expect(game.platforms.map((p) => p.slug).sort()).toEqual(['pc', 'ps4']);
      // Known genre uses the Spanish name; the unknown one keeps the IGDB name.
      expect(game.genres.map((g) => g.name).sort()).toEqual(['Brand New Genre', 'Rol (RPG)']);
      expect(game.coverAssetKey).toMatch(/^covers\/[0-9a-f]{64}\.jpg$/);
    });

    it('serves the stored cover publicly with immutable caching', async () => {
      const game = await importer.importGame(IGDB, '1942');

      const response = await request(app.getHttpServer())
        .get(`/api/assets/${game.coverAssetKey}`)
        .expect(200)
        .expect('Content-Type', 'image/jpeg')
        .expect('Cache-Control', 'public, max-age=31536000, immutable');
      expect(Buffer.from(response.body as Buffer)).toEqual(FAKE_JPEG);
    });

    it('maps unknown genres once and reuses them on later imports', async () => {
      catalog.add({
        externalId: '3000',
        name: 'Another',
        genres: [{ externalId: '777', name: 'Brand New Genre' }],
      });

      const first = await importer.importGame(IGDB, '1942');
      const second = await importer.importGame(IGDB, '3000');

      const newGenre = (g: Game) => g.genres.find((genre) => genre.name === 'Brand New Genre');
      expect(newGenre(second)?.id).toBe(newGenre(first)?.id);
    });

    it('returns the existing game without calling the provider again (no sync)', async () => {
      const first = await importer.importGame(IGDB, '1942');
      catalog.add({ externalId: '1942', name: 'Renamed upstream' });

      const second = await importer.importGame(IGDB, '1942');

      expect(second.id).toBe(first.id);
      expect(second.name).toBe('The Witcher 3: Wild Hunt');
      expect(catalog.calls.getGame).toBe(1);
    });

    it('creates a single game when imported concurrently', async () => {
      const results = await Promise.all([
        importer.importGame(IGDB, '1942'),
        importer.importGame(IGDB, '1942'),
        importer.importGame(IGDB, '1942'),
      ]);

      expect(new Set(results.map((g) => g.id)).size).toBe(1);
      await expect(games.countBy({ externalId: '1942' })).resolves.toBe(1);
    });

    it('still imports the game when the cover cannot be downloaded', async () => {
      catalog.failingImages = true;

      const game = await importer.importGame(IGDB, '1942');

      expect(game.coverAssetKey).toBeNull();
      expect(game.platforms).toHaveLength(2);
    });

    it('rejects games that do not exist or are not importable', async () => {
      await expect(importer.importGame(IGDB, '404')).rejects.toBeInstanceOf(
        CatalogGameNotFoundError,
      );
    });

    it('persists nothing when the provider is unavailable', async () => {
      catalog.failing = true;

      await expect(importer.importGame(IGDB, '1942')).rejects.toBeInstanceOf(
        CatalogUnavailableError,
      );
      await expect(games.count()).resolves.toBe(0);
    });
  });

  describe('GET /api/assets/:folder/:file', () => {
    it('returns 404 for missing or invalid keys', async () => {
      await request(app.getHttpServer()).get('/api/assets/covers/missing.jpg').expect(404);
      await request(app.getHttpServer()).get('/api/assets/covers/..%2F..%2F.env').expect(404);
    });
  });
});
