import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import type { DataSource } from 'typeorm';
import type { ActivityPageDto } from '../src/activity/activity.service';
import type { UserGameDetailsDto } from '../src/library/dto/user-game-response.dto';
import { Platform } from '../src/platforms/platform.entity';
import { createTestApp } from './create-test-app';
import type { FakeCatalogProvider } from './fake-catalog-provider';
import { as, registerUser, type TestUser } from './test-users';

describe('Activity (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let catalog: FakeCatalogProvider;
  let resetDatabase: () => Promise<void>;
  let alice: TestUser;
  let bob: TestUser;
  let carol: TestUser;
  let pcId: string;

  beforeAll(async () => {
    ({ app, dataSource, catalog, resetDatabase } = await createTestApp());
    pcId = (await dataSource.getRepository(Platform).findOneByOrFail({ slug: 'pc' })).id;
  });

  beforeEach(async () => {
    await resetDatabase();
    alice = await registerUser(app, 'alice@example.com');
    bob = await registerUser(app, 'bobby@example.com');
    carol = await registerUser(app, 'carol@example.com');
  });

  afterAll(async () => {
    await app.close();
  });

  const feed = async (user: TestUser, cursor?: string) =>
    (
      await as(app, user)
        .get(`/api/activity${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`)
        .expect(200)
    ).body as ActivityPageDto;
  const summary = (page: ActivityPageDto) =>
    page.items.map((item) => [item.user.username, item.type, item.game?.name ?? null, item.data]);
  const addGame = async (user: TestUser, name: string, status = 'PENDING') =>
    (
      await as(app, user)
        .post('/api/library', {
          manualGame: { name },
          platformId: pcId,
          initialPlaythrough: { status },
        })
        .expect(201)
    ).body as UserGameDetailsDto;
  const befriend = async (a: TestUser, b: TestUser) => {
    await as(app, a).post('/api/friends/requests', { username: b.username }).expect(200);
    await as(app, b).post(`/api/friends/requests/${a.username}/accept`).expect(204);
  };

  it('records what the user does, grouping repeated events on a game', async () => {
    const hades = await addGame(alice, 'Hades', 'COMPLETED');
    const url = `/api/library/${hades.id}`;
    await as(app, alice).patch(url, { rating: 80 }).expect(200);
    await as(app, alice).patch(url, { rating: 95 }).expect(200);
    await as(app, alice).patch(url, { notes: 'not an event' }).expect(200);
    await as(app, alice).patch(url, { favorite: true }).expect(200);
    await as(app, alice).post(`${url}/playthroughs`, { status: 'IN_PROGRESS' }).expect(201);
    for (const name of ['A', 'B']) {
      const game = (await as(app, alice).post(`${url}/achievements`, { name }).expect(201))
        .body as UserGameDetailsDto;
      const achievement = game.achievementList.find((a) => a.name === name)!;
      await as(app, alice)
        .patch(`${url}/achievements/${achievement.id}`, { achieved: true })
        .expect(200);
    }
    await as(app, alice)
      .put(`${url}/platinum`, { achieved: true, date: '2025-01-01', timeMinutes: 60 })
      .expect(200);
    // Editing the platinum again is not a new one.
    await as(app, alice)
      .put(`${url}/platinum`, { achieved: true, date: '2025-01-02', timeMinutes: 60 })
      .expect(200);
    catalog.add({ externalId: '72', name: 'Portal 2', platformExternalIds: ['6'] });
    await as(app, alice).post('/api/wishlist', { provider: 'igdb', externalId: '72' }).expect(201);

    const page = await feed(alice);
    expect(summary(page)).toEqual([
      ['alice', 'WISHLISTED', 'Portal 2', {}],
      ['alice', 'PLATINUM', 'Hades', {}],
      ['alice', 'ACHIEVEMENTS', 'Hades', { count: 2 }],
      ['alice', 'STATUS_CHANGED', 'Hades', { status: 'IN_PROGRESS' }],
      ['alice', 'FAVORITED', 'Hades', {}],
      ['alice', 'RATED', 'Hades', { rating: 95 }],
      ['alice', 'GAME_ADDED', 'Hades', { status: 'COMPLETED' }],
    ]);
    expect(page.items[1]).toMatchObject({
      self: true,
      game: { userGameId: hades.id, provider: null, externalId: null },
    });
    expect(page.items[0].game).toMatchObject({ provider: 'igdb', externalId: '72' });
    expect(page.next).toBeNull();
  });

  it('shows friends their activity, unless they made it private', async () => {
    await addGame(alice, 'Hades', 'IN_PROGRESS');
    await addGame(bob, 'Celeste');
    await addGame(carol, 'Doom');
    await befriend(alice, bob);

    expect(summary(await feed(bob))).toEqual([
      ['bobby', 'GAME_ADDED', 'Celeste', { status: 'PENDING' }],
      ['alice', 'GAME_ADDED', 'Hades', { status: 'IN_PROGRESS' }],
    ]);
    expect((await feed(bob)).items[1].self).toBe(false);
    // Carol isn't a friend: only her own.
    expect(summary(await feed(carol))).toEqual([
      ['carol', 'GAME_ADDED', 'Doom', { status: 'PENDING' }],
    ]);
    const hidden = await as(app, carol).get('/api/users/alice/activity').expect(404);
    expect(hidden.body).toMatchObject({ code: 'USER_NOT_FOUND' });
    const friendActivity = (await as(app, bob).get('/api/users/alice/activity').expect(200))
      .body as ActivityPageDto;
    expect(summary(friendActivity)).toEqual([
      ['alice', 'GAME_ADDED', 'Hades', { status: 'IN_PROGRESS' }],
    ]);

    await as(app, alice).put('/api/profile/visibility', { visibility: 'PRIVATE' }).expect(204);
    expect(summary(await feed(bob))).toEqual([
      ['bobby', 'GAME_ADDED', 'Celeste', { status: 'PENDING' }],
    ]);
    await as(app, bob).get('/api/users/alice/activity').expect(403);
    // Still visible to herself (and she still sees her friends').
    expect(summary(await feed(alice)).map(([user]) => user)).toEqual(['bobby', 'alice']);
  });

  it('keeps events of games that left the library', async () => {
    const hades = await addGame(alice, 'Hades');
    await as(app, alice).delete(`/api/library/${hades.id}`).expect(204);
    expect((await feed(alice)).items[0]).toMatchObject({
      type: 'GAME_ADDED',
      game: { name: 'Hades', userGameId: null },
    });
  });

  it('pages from newest to oldest', async () => {
    for (let i = 1; i <= 32; i++) {
      await addGame(alice, `Game ${i}`);
    }
    const first = await feed(alice);
    expect(first.items).toHaveLength(30);
    expect(first.items[0].game?.name).toBe('Game 32');
    const second = await feed(alice, first.next!);
    expect(second.items.map((i) => i.game?.name)).toEqual(['Game 2', 'Game 1']);
    expect(second.next).toBeNull();
    await as(app, alice).get('/api/activity?cursor=nope').expect(400);
  });
});
