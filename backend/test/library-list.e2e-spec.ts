import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import type { DataSource } from 'typeorm';
import type {
  UserGameDetailsDto,
  UserGameListItemDto,
} from '../src/library/dto/user-game-response.dto';
import { Genre } from '../src/genres/genre.entity';
import { Platform } from '../src/platforms/platform.entity';
import { createTestApp } from './create-test-app';
import type { FakeCatalogProvider } from './fake-catalog-provider';
import { as, registerUser, type TestUser } from './test-users';

describe('Library list: search, filters and sort (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let catalog: FakeCatalogProvider;
  let resetDatabase: () => Promise<void>;
  let alice: TestUser;
  let platformIds: Record<string, string>;
  let platformGenreId: string;

  beforeAll(async () => {
    ({ app, dataSource, catalog, resetDatabase } = await createTestApp());
    const platforms = await dataSource.getRepository(Platform).find();
    platformIds = Object.fromEntries(platforms.map((p) => [p.slug, p.id]));
    platformGenreId = (await dataSource.getRepository(Genre).findOneByOrFail({ slug: 'platform' }))
      .id;
  });

  beforeEach(async () => {
    await resetDatabase();
    alice = await registerUser(app, 'alice@example.com');
    const bob = await registerUser(app, 'bob@example.com');

    // Fall Guys: catalog game (genre "Plataformas"), PS5, in progress, rated 70, 100 min.
    catalog.add({
      externalId: '100',
      name: 'Fall Guys',
      platformExternalIds: ['167'],
      genres: [{ externalId: '8', name: 'Platform' }],
    });
    const fallGuys = (
      await as(app, alice)
        .post('/api/library', {
          catalog: { provider: 'igdb', externalId: '100' },
          platformId: platformIds.ps5,
        })
        .expect(201)
    ).body as UserGameDetailsDto;
    const fg = as(app, alice);
    await fg.patch(`/api/library/${fallGuys.id}`, { rating: 70 }).expect(200);
    await fg
      .patch(`/api/library/${fallGuys.id}/playthroughs/${fallGuys.playthroughs[0].id}`, {
        status: 'IN_PROGRESS',
        startDate: '2026-02-01',
      })
      .expect(200);
    await fg
      .put(`/api/library/${fallGuys.id}/playthroughs/${fallGuys.playthroughs[0].id}/manual-time`, {
        minutes: 100,
      })
      .expect(200);

    // Bloodborne: manual, PS4, completed, rated 95, platinum, 900 min.
    const bloodborne = (
      await as(app, alice)
        .post('/api/library', { manualGame: { name: 'Bloodborne' }, platformId: platformIds.ps4 })
        .expect(201)
    ).body as UserGameDetailsDto;
    await fg
      .patch(`/api/library/${bloodborne.id}/playthroughs/${bloodborne.playthroughs[0].id}`, {
        status: 'COMPLETED',
        startDate: '2025-01-01',
        completionDate: '2025-03-01',
      })
      .expect(200);
    await fg
      .put(
        `/api/library/${bloodborne.id}/playthroughs/${bloodborne.playthroughs[0].id}/manual-time`,
        {
          minutes: 900,
        },
      )
      .expect(200);
    await fg.patch(`/api/library/${bloodborne.id}`, { rating: 95 }).expect(200);
    await fg
      .put(`/api/library/${bloodborne.id}/platinum`, {
        achieved: true,
        date: '2025-04-01',
        timeMinutes: 1200,
      })
      .expect(200);

    // Zelda: manual, Switch, pending, unrated, no time.
    await as(app, alice)
      .post('/api/library', { manualGame: { name: 'zelda' }, platformId: platformIds.switch })
      .expect(201);

    // Bob's games never appear in Alice's library.
    await as(app, bob)
      .post('/api/library', { manualGame: { name: 'Bloodborne' }, platformId: platformIds.ps5 })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  const list = async (query: Record<string, string> = {}) =>
    (
      await as(app, alice)
        .get(`/api/library?${new URLSearchParams(query).toString()}`)
        .expect(200)
    ).body as UserGameListItemDto[];
  const names = (items: UserGameListItemDto[]) => items.map((i) => i.game.name);

  it('returns card data for each of the user’s games only', async () => {
    const items = await list({ sort: 'name', order: 'asc' });

    expect(names(items)).toEqual(['Bloodborne', 'Fall Guys', 'zelda']);
    expect(items[0]).toMatchObject({
      game: { name: 'Bloodborne', coverUrl: null, isManual: true },
      platform: { shortName: 'PS4' },
      status: 'COMPLETED',
      totalMinutes: 900,
      rating: 95,
      platinumAchieved: true,
    });
  });

  it('searches by name, case-insensitively and with literal wildcards', async () => {
    expect(names(await list({ search: 'BLOOD' }))).toEqual(['Bloodborne']);
    expect(names(await list({ search: ' fall ' }))).toEqual(['Fall Guys']);
    expect(await list({ search: '%' })).toEqual([]);
  });

  it.each([
    [{ status: 'IN_PROGRESS' }, ['Fall Guys']],
    [{ status: 'COMPLETED' }, ['Bloodborne']],
    [{ status: 'PENDING' }, ['zelda']],
    [{ platinum: 'true' }, ['Bloodborne']],
    [{ platinum: 'false' }, ['Fall Guys', 'zelda']],
  ])('filters by %j', async (filter, expected) => {
    expect(names(await list({ ...filter, sort: 'name', order: 'asc' }))).toEqual(expected);
  });

  it('filters by platform and by genre, and combines filters', async () => {
    expect(names(await list({ platformId: platformIds.ps4 }))).toEqual(['Bloodborne']);
    expect(names(await list({ genreId: platformGenreId }))).toEqual(['Fall Guys']);
    expect(await list({ genreId: platformGenreId, status: 'COMPLETED' })).toEqual([]);
    // 'l' matches all three; only Bloodborne has the platinum.
    expect(
      names(await list({ search: 'l', platinum: 'false', sort: 'name', order: 'asc' })),
    ).toEqual(['Fall Guys', 'zelda']);
  });

  it.each([
    [{ sort: 'rating', order: 'desc' }, ['Bloodborne', 'Fall Guys', 'zelda']],
    [{ sort: 'rating', order: 'asc' }, ['Fall Guys', 'Bloodborne', 'zelda']],
    [{ sort: 'totalMinutes', order: 'desc' }, ['Bloodborne', 'Fall Guys', 'zelda']],
    [{ sort: 'startDate', order: 'asc' }, ['Bloodborne', 'Fall Guys', 'zelda']],
    [{ sort: 'completionDate', order: 'desc' }, ['Bloodborne', 'Fall Guys', 'zelda']],
    [{ sort: 'name', order: 'desc' }, ['zelda', 'Fall Guys', 'Bloodborne']],
    [{}, ['zelda', 'Bloodborne', 'Fall Guys']],
  ])('sorts by %j with missing values last', async (sort, expected) => {
    expect(names(await list(sort))).toEqual(expected);
  });

  it.each([
    [{ status: 'PLATINUM' }],
    [{ sort: 'random' }],
    [{ order: 'up' }],
    [{ platinum: 'yes' }],
    [{ platformId: 'ps5' }],
    [{ unknown: '1' }],
  ])('rejects invalid query %j', async (query) => {
    await as(app, alice)
      .get(`/api/library?${new URLSearchParams(query).toString()}`)
      .expect(400);
  });
});
