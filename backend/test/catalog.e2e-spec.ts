import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { DataSource, Repository } from 'typeorm';
import { CatalogProvider } from '../src/catalog/catalog-provider';
import { Game } from '../src/games/game.entity';
import { GamesService } from '../src/games/games.service';
import { Genre } from '../src/genres/genre.entity';
import { Platform } from '../src/platforms/platform.entity';
import { User } from '../src/users/user.entity';
import { createTestApp } from './create-test-app';

describe('Catalog base: platforms, genres and games (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let resetDatabase: () => Promise<void>;
  let games: Repository<Game>;
  let platforms: Repository<Platform>;
  let genres: Repository<Genre>;

  beforeAll(async () => {
    ({ app, dataSource, resetDatabase } = await createTestApp());
    games = dataSource.getRepository(Game);
    platforms = dataSource.getRepository(Platform);
    genres = dataSource.getRepository(Genre);
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await app.close();
  });

  async function registerUser(email: string): Promise<{ user: User; cookie: string }> {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'super-secret-1' })
      .expect(201);
    const setCookie = (response.headers['set-cookie'] as unknown as string[])[0];
    const user = await dataSource.getRepository(User).findOneByOrFail({ email });
    return { user, cookie: setCookie.split(';')[0] };
  }

  const platformBySlug = (slug: string) => platforms.findOneByOrFail({ slug });
  const genreBySlug = (slug: string) => genres.findOneByOrFail({ slug });

  function catalogGame(externalId: string, overrides: Partial<Game> = {}): Promise<Game> {
    return games.save(
      games.create({
        provider: CatalogProvider.Igdb,
        externalId,
        createdByUserId: null,
        name: `Game ${externalId}`,
        ...overrides,
      }),
    );
  }

  function manualGame(userId: string, name = 'My homebrew'): Promise<Game> {
    return games.save(
      games.create({ provider: null, externalId: null, createdByUserId: userId, name }),
    );
  }

  describe('GET /api/platforms', () => {
    it('requires a session', async () => {
      await request(app.getHttpServer()).get('/api/platforms').expect(401);
    });

    it('lists the preloaded platforms in display order', async () => {
      const { cookie } = await registerUser('player@example.com');

      const response = await request(app.getHttpServer())
        .get('/api/platforms')
        .set('Cookie', cookie)
        .expect(200);

      const body = response.body as { slug: string; shortName: string }[];
      expect(body).toHaveLength(31);
      expect(body[0]).toEqual({
        id: expect.any(String),
        slug: 'ps5',
        name: 'PlayStation 5',
        shortName: 'PS5',
      });
      expect(body.map((p) => p.shortName)).toEqual(
        expect.arrayContaining(['PS4', 'Xbox Series X|S', 'Xbox One', 'PC', 'Switch', 'Switch 2']),
      );
    });
  });

  describe('GET /api/genres', () => {
    it('lists genres with Spanish names, alphabetically', async () => {
      const { cookie } = await registerUser('player@example.com');

      const response = await request(app.getHttpServer())
        .get('/api/genres')
        .set('Cookie', cookie)
        .expect(200);

      const names = (response.body as { name: string }[]).map((g) => g.name);
      expect(names).toHaveLength(23);
      expect(names).toContain('Rol (RPG)');
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'es')));
    });
  });

  describe('IGDB mappings', () => {
    it('maps IGDB Windows, Mac and Linux to the single PC platform', async () => {
      const rows = await dataSource.query<{ external_id: string }[]>(
        `SELECT e.external_id FROM platform_external_ids e
         JOIN platforms p ON p.id = e.platform_id WHERE p.slug = 'pc' ORDER BY 1`,
      );
      expect(rows.map((r) => r.external_id)).toEqual(['14', '3', '6']);
    });
  });

  describe('games table constraints', () => {
    it('stores catalog data with its platforms and genres', async () => {
      const ps4 = await platformBySlug('ps4');
      const ps5 = await platformBySlug('ps5');
      const rpg = await genreBySlug('role-playing');

      const game = await catalogGame('1942', {
        name: 'God of War Ragnarök',
        releaseDate: '2022-11-09',
        developers: ['Santa Monica Studio'],
        publishers: ['Sony Interactive Entertainment'],
        platforms: [ps5, ps4],
        genres: [rpg],
      });

      const loaded = await games.findOneOrFail({
        where: { id: game.id },
        relations: { platforms: true, genres: true },
      });
      expect(loaded.platforms.map((p) => p.slug).sort()).toEqual(['ps4', 'ps5']);
      expect(loaded.genres.map((g) => g.name)).toEqual(['Rol (RPG)']);
      expect(loaded.developers).toEqual(['Santa Monica Studio']);
      expect(loaded.releaseDate).toBe('2022-11-09');
    });

    it('rejects importing the same external game twice', async () => {
      await catalogGame('1942');

      await expect(catalogGame('1942')).rejects.toThrow(/UQ_games_provider_external_id/);
    });

    it('allows several manual games with the same name', async () => {
      const { user } = await registerUser('player@example.com');

      await manualGame(user.id, 'Same name');
      await expect(manualGame(user.id, 'Same name')).resolves.toBeDefined();
    });

    it.each([
      [
        'a manual game without creator',
        { provider: null, externalId: null, createdByUserId: null },
      ],
      [
        'a catalog game without external id',
        { provider: CatalogProvider.Igdb, externalId: null, createdByUserId: null },
      ],
    ])('rejects %s', async (_case, origin) => {
      await expect(games.save(games.create({ name: 'Broken', ...origin }))).rejects.toThrow(
        /CHK_games_origin/,
      );
    });

    it('rejects a catalog game that also has a creator', async () => {
      const { user } = await registerUser('player@example.com');

      await expect(catalogGame('1', { createdByUserId: user.id })).rejects.toThrow(
        /CHK_games_origin/,
      );
    });

    it('rejects blank names', async () => {
      await expect(catalogGame('1', { name: '   ' })).rejects.toThrow(/CHK_games_name_not_blank/);
    });
  });

  describe('GamesService.findVisibleById', () => {
    it('shows catalog games to everyone and manual games only to their creator', async () => {
      const service = app.get(GamesService);
      const alice = (await registerUser('alice@example.com')).user;
      const bob = (await registerUser('bob@example.com')).user;
      const shared = await catalogGame('100');
      const alicesGame = await manualGame(alice.id);

      await expect(service.findVisibleById(shared.id, bob.id)).resolves.toMatchObject({
        id: shared.id,
      });
      await expect(service.findVisibleById(alicesGame.id, alice.id)).resolves.toMatchObject({
        id: alicesGame.id,
      });
      await expect(service.findVisibleById(alicesGame.id, bob.id)).resolves.toBeNull();
    });

    it('loads platforms in display order', async () => {
      const service = app.get(GamesService);
      const { user } = await registerUser('player@example.com');
      const game = await catalogGame('200', {
        platforms: [await platformBySlug('pc'), await platformBySlug('ps5')],
      });

      const found = await service.findVisibleById(game.id, user.id);

      expect(found?.platforms.map((p) => p.slug)).toEqual(['ps5', 'pc']);
    });
  });

  describe('deletion', () => {
    it("deletes a user's manual games with the user but keeps catalog games", async () => {
      const { user } = await registerUser('player@example.com');
      const manual = await manualGame(user.id);
      const shared = await catalogGame('300');

      await dataSource.getRepository(User).delete({ id: user.id });

      await expect(games.findOneBy({ id: manual.id })).resolves.toBeNull();
      await expect(games.findOneBy({ id: shared.id })).resolves.not.toBeNull();
    });

    it('removes GamePlatform links with the game but never the platforms', async () => {
      const ps5 = await platformBySlug('ps5');
      const game = await catalogGame('400', { platforms: [ps5] });

      await games.delete({ id: game.id });

      const [{ count }] = await dataSource.query<{ count: string }[]>(
        'SELECT count(*) FROM game_platforms',
      );
      expect(count).toBe('0');
      await expect(platforms.findOneBy({ id: ps5.id })).resolves.not.toBeNull();
    });
  });
});
