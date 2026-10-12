import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { DataSource } from 'typeorm';
import type {
  DiscoverResponseDto,
  RecommendationsResponseDto,
} from '../src/catalog/catalog-discover.service';
import type {
  ReleasesResponseDto,
  UndatedResponseDto,
} from '../src/catalog/catalog-releases.service';
import type { CatalogHighlight, ReleaseDatePrecision } from '../src/catalog/game-catalog-provider';
import { Game } from '../src/games/game.entity';
import { Platform } from '../src/platforms/platform.entity';
import { createTestApp } from './create-test-app';
import type { FakeCatalogProvider } from './fake-catalog-provider';
import { as, registerUser, type TestUser } from './test-users';

function card(externalId: string, extra: Partial<CatalogHighlight> = {}): CatalogHighlight {
  return {
    externalId,
    name: `Game ${externalId}`,
    releaseDate: '2025-05-01',
    coverRef: `co${externalId}`,
    artworkRef: null,
    // 167 PS5, 6 Windows (PC).
    platformExternalIds: ['167', '6'],
    ...extra,
  };
}

describe('Discover and releases (e2e)', () => {
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
    alice = await registerUser(app, 'alice@example.com');
    bob = await registerUser(app, 'bob@example.com');
  });

  afterAll(async () => {
    await app.close();
  });

  const anonymous = () => request(app.getHttpServer());

  /** Adds a catalog game to a library, optionally rated or as a favorite. */
  async function own(
    user: TestUser,
    externalId: string,
    options: { rating?: number; favorite?: boolean; genres?: string[] } = {},
  ) {
    catalog.add({
      externalId,
      name: `Owned ${externalId}`,
      coverRef: null,
      platformExternalIds: ['167'],
      genres: (options.genres ?? []).map((id) => ({ externalId: id, name: `Genre ${id}` })),
    });
    const created = await as(app, user)
      .post('/api/library', {
        catalog: { provider: 'igdb', externalId },
        platformId: platformIds.ps5,
        ...(options.rating ? { rating: options.rating } : {}),
      })
      .expect(201);
    if (options.favorite) {
      await as(app, user)
        .patch(`/api/library/${(created.body as { id: string }).id}`, { favorite: true })
        .expect(200);
    }
  }

  describe('GET /api/catalog/discover', () => {
    it('is public, maps our filters to the provider and pages', async () => {
      catalog.discoverResults = Array.from({ length: 30 }, (_, i) => card(String(100 + i)));

      const first = (
        await anonymous()
          .get('/api/catalog/discover?platform=pc&genre=role-playing&release=2025&sort=top-rated')
          .expect(200)
      ).body as DiscoverResponseDto;

      expect(first.games).toHaveLength(24);
      expect(first.hasMore).toBe(true);
      expect(first.games[0]).toEqual({
        provider: 'igdb',
        externalId: '100',
        name: 'Game 100',
        releaseDate: '2025-05-01',
        coverUrl: '/api/catalog/igdb/images/co100?size=cover',
        artworkUrl: null,
        platforms: [
          expect.objectContaining({ slug: 'ps5' }),
          expect.objectContaining({ slug: 'pc' }),
        ],
        libraryPlatformIds: [],
        wishlistItemId: null,
      });
      const filter = catalog.discoverFilters[0];
      // PC = Windows, Mac and Linux on IGDB.
      expect([...filter.platformExternalIds].sort()).toEqual(['14', '3', '6']);
      expect(filter.genreExternalIds).toEqual(['12']);
      expect(filter).toMatchObject({
        releasedFrom: '2025-01-01',
        releasedTo: '2025-12-31',
        sort: 'top-rated',
        offset: 0,
        limit: 25,
      });

      const second = (await anonymous().get('/api/catalog/discover?page=2').expect(200))
        .body as DiscoverResponseDto;
      expect(second.games).toHaveLength(6);
      expect(second.hasMore).toBe(false);
      expect(catalog.discoverFilters[1].offset).toBe(24);
    });

    it('defaults upcoming games to the most anticipated', async () => {
      await anonymous().get('/api/catalog/discover?release=upcoming').expect(200);
      expect(catalog.discoverFilters[0].sort).toBe('anticipated');
      expect(catalog.discoverFilters[0].releasedTo).toBeNull();
    });

    it('returns nothing for unknown platforms or genres (never "no filter")', async () => {
      catalog.discoverResults = [card('1')];
      const body = (await anonymous().get('/api/catalog/discover?platform=nope').expect(200))
        .body as DiscoverResponseDto;
      expect(body.games).toEqual([]);
      expect(catalog.discoverFilters).toHaveLength(0);
    });

    it('validates the query', async () => {
      for (const query of [
        'platform=PC;drop',
        'release=yesterday',
        'release=1800',
        'sort=random',
        'page=0',
        'page=21',
      ]) {
        await anonymous().get(`/api/catalog/discover?${query}`).expect(400);
      }
    });

    it("marks the user's own games (library platforms and wishlist), only theirs", async () => {
      await own(alice, '100');
      catalog.discoverResults = [card('100'), card('101')];

      const forAlice = (await as(app, alice).get('/api/catalog/discover').expect(200))
        .body as DiscoverResponseDto;
      expect(forAlice.games[0].libraryPlatformIds).toEqual([platformIds.ps5]);
      expect(forAlice.games[1].libraryPlatformIds).toEqual([]);

      const forBob = (await as(app, bob).get('/api/catalog/discover').expect(200))
        .body as DiscoverResponseDto;
      expect(forBob.games[0].libraryPlatformIds).toEqual([]);
    });

    it('reports an unavailable catalog without failing', async () => {
      catalog.failing = true;
      const body = (await anonymous().get('/api/catalog/discover').expect(200))
        .body as DiscoverResponseDto;
      expect(body).toEqual({ games: [], page: 1, hasMore: false, catalogAvailable: false });
    });
  });

  describe('GET /api/catalog/recommendations', () => {
    it('offers general discovery to anonymous visitors and new users', async () => {
      catalog.discoverResults = [card('1'), card('2')];

      for (const response of [
        await anonymous().get('/api/catalog/recommendations').expect(200),
        await as(app, alice).get('/api/catalog/recommendations').expect(200),
      ]) {
        const body = response.body as RecommendationsResponseDto;
        expect(body.personalized).toBe(false);
        expect(body.games.map((g) => g.externalId)).toEqual(['1', '2']);
      }
      expect(catalog.discoverFilters[0]).toMatchObject({ sort: 'popular', genreExternalIds: [] });
    });

    it('personalizes with favorites, ratings and genres, never recommending owned games', async () => {
      // 12 = RPG, 31 = Adventure, 5 = Shooter (disliked).
      await own(alice, '10', { favorite: true, genres: ['12'] });
      await own(alice, '11', { rating: 90, genres: ['12', '31'] });
      await own(alice, '12', { rating: 30, genres: ['5'] });
      catalog.similar.set('10', [card('200'), card('11'), card('201')]);
      catalog.similar.set('11', [card('201'), card('202')]);
      catalog.discoverResults = [card('300'), card('10'), card('200')];

      const body = (await as(app, alice).get('/api/catalog/recommendations').expect(200))
        .body as RecommendationsResponseDto;

      expect(body.personalized).toBe(true);
      expect(body.basedOnGenres.map((g) => g.slug)).toEqual(['role-playing', 'adventure']);
      expect(body.games.map((g) => g.externalId)).toEqual(['200', '201', '202', '300']);
      // The favorite first, then the best rated; the disliked game is no seed.
      expect(catalog.similarCalls[0].externalIds).toEqual(['10', '11']);
      const byGenre = catalog.discoverFilters.find((f) => f.genreExternalIds.length > 0);
      expect(byGenre).toMatchObject({ genreExternalIds: ['12', '31'], sort: 'top-rated' });
      expect([...byGenre!.excludeExternalIds].sort()).toEqual(['10', '11', '12']);

      // Bob's recommendations know nothing about Alice's library.
      const forBob = (await as(app, bob).get('/api/catalog/recommendations').expect(200))
        .body as RecommendationsResponseDto;
      expect(forBob.personalized).toBe(false);
    });
  });

  describe('GET /api/catalog/releases', () => {
    const release = (
      externalId: string,
      date: string,
      precision: ReleaseDatePrecision = 'day',
    ) => ({
      ...card(externalId),
      releaseDate: date,
      date,
      precision,
      releasePlatformExternalIds: ['167'],
    });

    it('returns the releases of the range with confirmed or estimated dates', async () => {
      catalog.releases = [
        release('1', '2026-10-12'),
        release('2', '2026-10-01', 'month'),
        release('3', '2026-12-31', 'quarter'),
      ];
      await own(alice, '1');

      const body = (
        await as(app, alice)
          .get('/api/catalog/releases?from=2026-10-01&to=2026-10-31&platform=ps5')
          .expect(200)
      ).body as ReleasesResponseDto;

      expect(body.catalogAvailable).toBe(true);
      expect(body.releases.map((r) => [r.externalId, r.date, r.precision])).toEqual([
        ['1', '2026-10-12', 'day'],
        ['2', '2026-10-01', 'month'],
      ]);
      expect(body.releases[0].releasePlatforms).toEqual([expect.objectContaining({ slug: 'ps5' })]);
      expect(body.releases[0].libraryPlatformIds).toEqual([platformIds.ps5]);
      expect(catalog.releaseQueries[0].filter.platformExternalIds).toEqual(['167']);
    });

    it('validates the range (dates, order and at most 93 days)', async () => {
      for (const query of [
        'from=2026-10-01',
        'from=2026-13-01&to=2026-12-01',
        'from=2026-10-10&to=2026-10-01',
        'from=2026-01-01&to=2026-06-01',
        'from=2026-02-30&to=2026-03-01',
      ]) {
        await anonymous().get(`/api/catalog/releases?${query}`).expect(400);
      }
      await anonymous().get('/api/catalog/releases?from=2026-10-01&to=2027-01-02').expect(200);
    });

    it('lists announced games without a date separately', async () => {
      catalog.undated = [card('900', { releaseDate: null })];
      const body = (await anonymous().get('/api/catalog/releases/undated').expect(200))
        .body as UndatedResponseDto;
      expect(body.games.map((g) => g.externalId)).toEqual(['900']);
    });

    it('never imports anything', async () => {
      catalog.releases = [release('1', '2026-10-12')];
      await anonymous().get('/api/catalog/releases?from=2026-10-01&to=2026-10-31').expect(200);
      expect(await dataSource.getRepository(Game).count()).toBe(0);
    });
  });
});
