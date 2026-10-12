import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { DataSource } from 'typeorm';
import type { CatalogHighlightsDto } from '../src/catalog/catalog-highlights.service';
import { Game } from '../src/games/game.entity';
import { createTestApp } from './create-test-app';
import type { FakeCatalogProvider } from './fake-catalog-provider';
import { as, registerUser, type TestUser } from './test-users';

describe('Catalog highlights for the Home (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let catalog: FakeCatalogProvider;
  let resetDatabase: () => Promise<void>;
  let user: TestUser;

  beforeAll(async () => {
    ({ app, dataSource, catalog, resetDatabase } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase();
    user = await registerUser(app, 'player@example.com');
    catalog.highlights = {
      recent: [
        {
          externalId: '500',
          name: 'Recent Hit',
          releaseDate: '2026-09-15',
          coverRef: 'corecent',
          artworkRef: 'arrecent',
          // 167 PS5, 6 Windows (PC), 999999 unknown.
          platformExternalIds: ['167', '6', '999999'],
        },
        {
          externalId: '501',
          name: 'No Artwork',
          releaseDate: '2026-08-01',
          coverRef: 'conoart',
          artworkRef: null,
          platformExternalIds: [],
        },
      ],
      upcoming: [
        {
          externalId: '600',
          name: 'Coming Soon',
          releaseDate: '2027-02-23',
          coverRef: 'cosoon',
          artworkRef: 'arsoon',
          platformExternalIds: ['167'],
        },
      ],
    };
  });

  afterAll(async () => {
    await app.close();
  });

  const getHighlights = () => as(app, user).get('/api/catalog/highlights');

  it('returns recent and upcoming games with proxied cover and artwork URLs', async () => {
    const body = (await getHighlights().expect(200)).body as CatalogHighlightsDto;

    expect(body.catalogAvailable).toBe(true);
    expect(body.recent.map((g) => g.name)).toEqual(['Recent Hit', 'No Artwork']);
    expect(body.recent[0]).toEqual({
      provider: 'igdb',
      externalId: '500',
      name: 'Recent Hit',
      releaseDate: '2026-09-15',
      coverUrl: '/api/catalog/igdb/images/corecent?size=cover',
      artworkUrl: '/api/catalog/igdb/images/arrecent?size=artwork',
      platforms: [
        expect.objectContaining({ slug: 'ps5' }),
        expect.objectContaining({ slug: 'pc' }),
      ],
    });
    expect(body.recent[1].artworkUrl).toBeNull();
    expect(body.upcoming).toEqual([
      expect.objectContaining({ externalId: '600', name: 'Coming Soon' }),
    ]);
  });

  it('caches the lists and never imports anything', async () => {
    await getHighlights().expect(200);
    await getHighlights().expect(200);

    expect(catalog.calls.highlights).toBe(2); // one per list, then cached
    expect(await dataSource.getRepository(Game).count()).toBe(0);
  });

  it('degrades to empty lists when the catalog is unavailable', async () => {
    catalog.failing = true;

    const body = (await getHighlights().expect(200)).body as CatalogHighlightsDto;

    expect(body).toEqual({ recent: [], upcoming: [], catalogAvailable: false });
  });

  it('serves the artwork through the image proxy', async () => {
    const response = await as(app, user)
      .get('/api/catalog/igdb/images/arrecent?size=artwork')
      .expect(200);

    expect(response.headers['content-type']).toMatch(/^image\/jpeg/);
    expect(catalog.imageVariants).toEqual(['artwork']);
  });

  it('is public: the Home shows it to anonymous visitors too', async () => {
    await request(app.getHttpServer()).get('/api/catalog/highlights').expect(200);
    await request(app.getHttpServer())
      .get('/api/catalog/igdb/images/arrecent?size=artwork')
      .expect(200);
  });
});
