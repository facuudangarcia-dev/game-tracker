import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { DataSource } from 'typeorm';
import { ASSET_STORAGE, type AssetStorage } from '../src/assets/asset-storage';
import type { UserGameDetailsDto } from '../src/library/dto/user-game-response.dto';
import { Platform } from '../src/platforms/platform.entity';
import type { PlayerHighlightsDto, PlayerStatsDto } from '../src/profile/profile.service';
import type { UserResponseDto } from '../src/users/user-response.dto';
import { User } from '../src/users/user.entity';
import { createTestApp } from './create-test-app';
import { as, registerUser, type TestUser } from './test-users';

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('fake png payload'),
]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('fake jpeg')]);

describe('Profile: avatar and stats (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let resetDatabase: () => Promise<void>;
  let alice: TestUser;
  let bob: TestUser;
  let platformIds: Record<string, string>;

  beforeAll(async () => {
    ({ app, dataSource, resetDatabase } = await createTestApp());
    const platforms = await dataSource.getRepository(Platform).find();
    platformIds = Object.fromEntries(platforms.map((p) => [p.slug, p.id]));
  });

  beforeEach(async () => {
    await resetDatabase();
    alice = await registerUser(app, 'alice@example.com');
    bob = await registerUser(app, 'bob@example.com');
  });

  afterAll(async () => {
    await app.close();
  });

  const upload = (user: TestUser, data: Buffer, type = 'image/png') =>
    request(app.getHttpServer())
      .put('/api/profile/avatar/image')
      .set('Cookie', user.cookie)
      .set('Content-Type', type)
      .send(data);
  const me = async (user: TestUser) =>
    (await as(app, user).get('/api/auth/me').expect(200)).body as UserResponseDto;
  const storedKey = async (user: TestUser) =>
    (await dataSource.getRepository(User).findOneByOrFail({ id: user.id })).avatarAssetKey;

  describe('avatar', () => {
    it('starts without avatar and accepts a built-in preset', async () => {
      expect((await me(alice)).avatar).toBeNull();

      const body = (
        await as(app, alice).put('/api/profile/avatar', { preset: 'knight' }).expect(200)
      ).body as UserResponseDto;

      expect(body.avatar).toEqual({ kind: 'preset', preset: 'knight' });
      expect((await me(alice)).avatar).toEqual({ kind: 'preset', preset: 'knight' });
    });

    it.each([[{ preset: 'mario' }], [{ preset: '' }], [{}], [{ preset: 'knight', extra: 1 }]])(
      'rejects an invalid preset %p',
      async (body) => {
        await as(app, alice).put('/api/profile/avatar', body).expect(400);
      },
    );

    it('stores an uploaded image privately and serves it only to its owner', async () => {
      const body = (await upload(alice, PNG).expect(200)).body as UserResponseDto;

      expect(body.avatar).toEqual({
        kind: 'custom',
        url: expect.stringMatching(/^\/api\/profile\/avatar\/image\?v=[0-9a-f]{16}$/),
      });
      const image = await as(app, alice).get('/api/profile/avatar/image').expect(200);
      expect(image.headers['content-type']).toMatch(/^image\/png/);
      expect(image.headers['cache-control']).toMatch(/private/);
      expect(Buffer.from(image.body as Buffer).equals(PNG)).toBe(true);

      // Bob only ever gets his own avatar (he has none), never Alice's.
      await as(app, bob).get('/api/profile/avatar/image').expect(404);
      // Not reachable through the public assets route either.
      const key = (await storedKey(alice)) ?? '';
      expect(key).toMatch(/^avatars\/[0-9a-f]{64}\.png$/);
      await request(app.getHttpServer()).get(`/api/assets/${key}`).expect(404);
    });

    it('detects the format from the content, not from the declared type', async () => {
      await upload(alice, JPEG, 'image/png').expect(200);
      expect(await storedKey(alice)).toMatch(/\.jpg$/);

      const response = await upload(alice, Buffer.from('<svg onload="x"/>'), 'image/png').expect(
        400,
      );
      expect(response.body).toMatchObject({ code: 'AVATAR_INVALID_IMAGE' });
    });

    it('rejects images over 2 MB', async () => {
      const big = Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]);

      const response = await upload(alice, big).expect(413);

      expect(response.body).toMatchObject({ code: 'AVATAR_TOO_LARGE' });
      expect(await storedKey(alice)).toBeNull();
    });

    it('replaces and removes avatars, deleting images nobody uses', async () => {
      const storage = app.get<AssetStorage>(ASSET_STORAGE);
      await upload(alice, PNG).expect(200);
      const key = (await storedKey(alice)) ?? '';
      expect(await storage.get(key)).not.toBeNull();

      await as(app, alice).put('/api/profile/avatar', { preset: 'ninja' }).expect(200);
      expect(await storage.get(key)).toBeNull();

      await upload(alice, PNG).expect(200);
      await upload(bob, PNG).expect(200); // same image, same file
      const removed = (await as(app, alice).delete('/api/profile/avatar').expect(200))
        .body as UserResponseDto;
      expect(removed.avatar).toBeNull();
      // Still used by Bob: kept.
      expect(await storage.get(key)).not.toBeNull();
    });
  });

  describe('country', () => {
    it('starts with the country chosen at sign-up and stores the country of prices', async () => {
      expect((await me(alice)).country).toBe('AR');

      const body = (await as(app, alice).put('/api/profile/country', { country: 'au' }).expect(200))
        .body as UserResponseDto;

      expect(body.country).toBe('AU');
      expect((await me(alice)).country).toBe('AU');
      expect((await me(bob)).country).toBe('AR');

      await as(app, alice).put('/api/profile/country', { country: null }).expect(200);
      expect((await me(alice)).country).toBeNull();
    });

    it.each([[{ country: 'XX' }], [{ country: 'ARG' }], [{ country: 7 }], [{}]])(
      'rejects an invalid country %p',
      async (body) => {
        await as(app, alice).put('/api/profile/country', body).expect(400);
      },
    );

    it('requires a session', async () => {
      await request(app.getHttpServer())
        .put('/api/profile/country')
        .send({ country: 'AR' })
        .expect(401);
    });
  });

  describe('stats', () => {
    const add = async (
      user: TestUser,
      name: string,
      platform: string,
      status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'PLAYED',
      rating: number | null,
    ) => {
      const created = (
        await as(app, user)
          .post('/api/library', {
            manualGame: { name },
            platformId: platformIds[platform],
            initialPlaythrough: {
              status,
              startDate: status === 'PENDING' ? null : '2025-01-01',
              completionDate: status === 'COMPLETED' ? '2025-02-01' : null,
            },
            rating,
          })
          .expect(201)
      ).body as UserGameDetailsDto;
      return created;
    };

    it('is empty for a new player', async () => {
      const stats = (await as(app, alice).get('/api/profile/stats').expect(200))
        .body as PlayerStatsDto;

      expect(stats).toEqual({
        totalGames: 0,
        completed: 0,
        inProgress: 0,
        played: 0,
        pending: 0,
        platinums: 0,
        totalMinutes: 0,
        rated: 0,
        averageRating: null,
        playthroughs: 0,
        topPlatform: null,
      });
    });

    it("summarizes the player's own library", async () => {
      const done = await add(alice, 'Done', 'ps5', 'COMPLETED', 90);
      const playing = await add(alice, 'Playing', 'ps5', 'IN_PROGRESS', 75);
      await add(alice, 'Later', 'pc', 'PENDING', null);
      await add(alice, 'Online', 'pc', 'PLAYED', null);
      await add(bob, 'Not mine', 'pc', 'COMPLETED', 10);

      const base = (game: UserGameDetailsDto) => `/api/library/${game.id}`;
      await as(app, alice)
        .patch(`${base(done)}/playthroughs/${done.playthroughs[0].id}`, { previousMinutes: 600 })
        .expect(200);
      await as(app, alice)
        .patch(`${base(playing)}/playthroughs/${playing.playthroughs[0].id}`, {
          previousMinutes: 90,
        })
        .expect(200);
      await as(app, alice)
        .post(`${base(done)}/playthroughs`, {})
        .expect(201);
      await as(app, alice)
        .put(`${base(done)}/platinum`, { achieved: true, date: '2025-02-01', timeMinutes: 700 })
        .expect(200);

      const stats = (await as(app, alice).get('/api/profile/stats').expect(200))
        .body as PlayerStatsDto;

      expect(stats).toEqual({
        totalGames: 4,
        completed: 1,
        inProgress: 1,
        played: 1,
        pending: 1,
        platinums: 1,
        totalMinutes: 690,
        rated: 2,
        averageRating: 82.5,
        playthroughs: 5,
        topPlatform: { name: 'PlayStation 5', shortName: 'PS5', games: 2 },
      });
    });

    const highlights = async (user: TestUser) =>
      (await as(app, user).get('/api/profile/highlights').expect(200)).body as PlayerHighlightsDto;
    const setPrevious = (user: TestUser, game: UserGameDetailsDto, minutes: number) =>
      as(app, user)
        .patch(`/api/library/${game.id}/playthroughs/${game.playthroughs[0].id}`, {
          previousMinutes: minutes,
        })
        .expect(200);
    const favorite = (user: TestUser, game: UserGameDetailsDto, value: boolean) =>
      as(app, user).patch(`/api/library/${game.id}`, { favorite: value });

    it('has no highlights for a new player', async () => {
      expect(await highlights(alice)).toEqual({
        mostPlayed: null,
        fastest: null,
        highestRated: null,
        lowestRated: null,
        favorites: [],
      });
    });

    it("highlights the player's own most played, fastest and best/worst rated games", async () => {
      const witcher = await add(alice, 'Witcher', 'ps5', 'COMPLETED', 90);
      const quick = await add(alice, 'Quick', 'pc', 'COMPLETED', 75);
      const endless = await add(alice, 'Endless', 'ps5', 'IN_PROGRESS', 40);
      await add(alice, 'Later', 'pc', 'PENDING', null);
      const notMine = await add(bob, 'Not mine', 'pc', 'COMPLETED', 10);
      await setPrevious(alice, witcher, 600);
      await setPrevious(alice, endless, 900);
      await setPrevious(bob, notMine, 5);
      // "Quick" is completed without time: it never counts as the fastest.
      // A second, short completed playthrough of "Witcher" is the fastest one.
      await as(app, alice)
        .post(`/api/library/${witcher.id}/playthroughs`, {
          name: 'Speedrun',
          status: 'COMPLETED',
          startDate: '2025-03-01',
          completionDate: '2025-03-01',
          previousMinutes: 30,
        })
        .expect(201);

      const result = await highlights(alice);

      const ref = (game: UserGameDetailsDto, shortName: string) => ({
        userGameId: game.id,
        name: game.game.name,
        coverUrl: null,
        platform: { shortName },
      });
      expect(result).toEqual({
        mostPlayed: { ...ref(endless, 'PS5'), minutes: 900 },
        fastest: {
          ...ref(witcher, 'PS5'),
          minutes: 30,
          playthroughNumber: 2,
          playthroughName: 'Speedrun',
        },
        highestRated: { ...ref(witcher, 'PS5'), rating: 90 },
        lowestRated: { ...ref(endless, 'PS5'), rating: 40 },
        favorites: [],
      });
      expect(quick.rating).toBe(75);
    });

    it('does not repeat the only rated game as the lowest rated', async () => {
      await add(alice, 'Only', 'pc', 'COMPLETED', 80);
      const result = await highlights(alice);
      expect(result.highestRated?.rating).toBe(80);
      expect(result.lowestRated).toBeNull();
    });

    it('marks up to 5 favorites, in the order they were marked', async () => {
      const games: UserGameDetailsDto[] = [];
      for (const name of ['A', 'B', 'C', 'D', 'E', 'F']) {
        games.push(await add(alice, name, 'pc', 'PENDING', null));
      }
      for (const game of [games[2], games[0], games[1], games[3], games[4]]) {
        const body = (await favorite(alice, game, true).expect(200)).body as UserGameDetailsDto;
        expect(body.favorite).toBe(true);
      }
      // Marking again keeps its place; a sixth one is rejected.
      await favorite(alice, games[2], true).expect(200);
      const rejected = await favorite(alice, games[5], true).expect(409);
      expect((rejected.body as { code: string }).code).toBe('FAVORITES_LIMIT_REACHED');

      expect((await highlights(alice)).favorites.map((g) => g.name)).toEqual([
        'C',
        'A',
        'B',
        'D',
        'E',
      ]);

      // Unmarking frees a place; the list shows the flag too.
      await favorite(alice, games[0], false).expect(200);
      await favorite(alice, games[5], true).expect(200);
      expect((await highlights(alice)).favorites.map((g) => g.name)).toEqual([
        'C',
        'B',
        'D',
        'E',
        'F',
      ]);
      const list = (await as(app, alice).get('/api/library').expect(200)).body as {
        game: { name: string };
        favorite: boolean;
      }[];
      expect(
        list
          .filter((g) => g.favorite)
          .map((g) => g.game.name)
          .sort(),
      ).toEqual(['B', 'C', 'D', 'E', 'F']);
      // Other players' limits are independent and their favorites never show here.
      const bobs = await add(bob, 'Bob game', 'pc', 'PENDING', null);
      await favorite(bob, bobs, true).expect(200);
      expect((await highlights(alice)).favorites).toHaveLength(5);
      expect((await highlights(bob)).favorites.map((g) => g.name)).toEqual(['Bob game']);
    });

    it.each([[null], ['yes'], [1]])('rejects favorite = %p', async (value) => {
      const game = await add(alice, 'A', 'pc', 'PENDING', null);
      await as(app, alice).patch(`/api/library/${game.id}`, { favorite: value }).expect(400);
    });

    it('requires a session', async () => {
      await request(app.getHttpServer()).get('/api/profile/highlights').expect(401);
      await request(app.getHttpServer()).get('/api/profile/stats').expect(401);
      await request(app.getHttpServer()).put('/api/profile/avatar').send({}).expect(401);
      await request(app.getHttpServer()).get('/api/profile/avatar/image').expect(401);
    });
  });
});
