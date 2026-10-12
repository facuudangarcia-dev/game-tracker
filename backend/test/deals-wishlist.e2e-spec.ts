import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { DataSource } from 'typeorm';
import type { CatalogGameDto } from '../src/catalog/catalog-details.service';
import {
  DealsService,
  type DealsResponseDto,
  type GamePricesResponseDto,
  type RecommendedDealsResponseDto,
  type ShopsResponseDto,
} from '../src/deals/deals.service';
import type { DealsType } from '../src/deals/price-provider';
import { Platform } from '../src/platforms/platform.entity';
import type {
  PriceHistoryResponseDto,
  WishlistItemDto,
  WishlistResponseDto,
} from '../src/wishlist/wishlist.service';
import { createTestApp } from './create-test-app';
import type { FakeCatalogProvider } from './fake-catalog-provider';
import { fakeDeal, type FakePriceProvider } from './fake-price-provider';
import { as, registerUser, type TestUser } from './test-users';

describe('Deals and wishlist (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let catalog: FakeCatalogProvider;
  let prices: FakePriceProvider;
  let resetDatabase: () => Promise<void>;
  let alice: TestUser;
  let bob: TestUser;

  beforeAll(async () => {
    ({ app, dataSource, catalog, prices, resetDatabase } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase();
    alice = await registerUser(app, 'alice@example.com');
    bob = await registerUser(app, 'bob@example.com');
    catalog.add({
      externalId: '100',
      name: 'Hollow Knight',
      coverRef: 'cohk',
      platformExternalIds: ['6', '130'],
    });
    catalog.add({ externalId: '200', name: 'Celeste', platformExternalIds: ['6'] });
    catalog.add({ externalId: '300', name: 'Not In Stores', platformExternalIds: ['6'] });
  });

  afterAll(async () => {
    await app.close();
  });

  const anonymous = () => request(app.getHttpServer());

  function dealItem(
    id: string,
    title: string,
    price: number,
    regular: number,
    kind: DealsType = 'game',
  ) {
    return { priceGameId: id, title, kind, imageUrl: null, deal: fakeDeal(price, regular) };
  }

  async function wish(user: TestUser, externalId: string): Promise<WishlistItemDto> {
    return (await as(app, user).post('/api/wishlist', { provider: 'igdb', externalId }).expect(201))
      .body as WishlistItemDto;
  }

  describe('GET /api/deals', () => {
    it('is public and computes the discount from the real prices', async () => {
      prices.deals = [
        dealItem('g1', 'Portal 2', 4.99, 19.99),
        dealItem('g2', 'Full Price', 10, 10),
      ];

      const body = (await anonymous().get('/api/deals').expect(200)).body as DealsResponseDto;

      expect(body).toMatchObject({
        configured: true,
        available: true,
        country: 'AR',
        source: { name: 'IsThereAnyDeal', url: 'https://isthereanydeal.com' },
        hasMore: false,
      });
      expect(body.fetchedAt).toEqual(expect.any(String));
      expect(body.items[0]).toMatchObject({
        title: 'Portal 2',
        price: { amount: 4.99, currency: 'USD' },
        regular: { amount: 19.99, currency: 'USD' },
        cut: 75,
        shop: { id: 61, name: 'Steam' },
        url: 'https://itad.link/fake/',
      });
      expect(body.items[1].cut).toBe(0);
    });

    it('passes validated filters and caches identical queries', async () => {
      await anonymous()
        .get(
          '/api/deals?sort=price&shops=61,35,61&platform=mac&type=dlc&minCut=50&minPrice=1&maxPrice=9.99&offset=24',
        )
        .expect(200);
      await anonymous()
        .get(
          '/api/deals?sort=price&shops=35,61&platform=mac&type=dlc&minCut=50&minPrice=1&maxPrice=9.99&offset=24',
        )
        .expect(200);

      expect(prices.calls.listDeals).toBe(1);
      expect(prices.queries[0]).toEqual({
        country: 'AR',
        sort: 'price',
        shopIds: [35, 61],
        platform: 'mac',
        type: 'dlc',
        minCut: 50,
        minPrice: 1,
        maxPrice: 9.99,
        offset: 24,
        limit: 24,
      });
      for (const query of [
        'sort=cheapest',
        'shops=abc',
        'platform=ps5',
        'type=soundtrack',
        'minCut=101',
        'maxPrice=-1',
        'maxPrice=1.999',
        'offset=20000',
        'country=XX',
        'country=ARG',
      ]) {
        await anonymous().get(`/api/deals?${query}`).expect(400);
      }
    });

    it('filters by kind of product, showing everything by default', async () => {
      prices.deals = [
        dealItem('g1', 'Portal 2', 4.99, 19.99),
        dealItem('d1', 'Portal 2 - DLC', 1.99, 4.99, 'dlc'),
        dealItem('o1', 'Portal 2 Soundtrack', 0.99, 2.99, 'other'),
      ];
      const titles = async (query: string) =>
        (
          (await anonymous().get(`/api/deals${query}`).expect(200)).body as DealsResponseDto
        ).items.map((item) => item.title);

      expect(await titles('')).toEqual(['Portal 2', 'Portal 2 - DLC', 'Portal 2 Soundtrack']);
      expect(await titles('?type=game')).toEqual(['Portal 2']);
      expect(await titles('?type=dlc')).toEqual(['Portal 2 - DLC']);
      expect(await titles('?type=other')).toEqual(['Portal 2 Soundtrack']);
    });

    it('explains when the source is not configured or fails, inventing nothing', async () => {
      prices.configured = false;
      expect((await anonymous().get('/api/deals').expect(200)).body).toMatchObject({
        configured: false,
        available: false,
        items: [],
      });
      expect((await anonymous().get('/api/deals/shops').expect(200)).body).toMatchObject({
        configured: false,
        shops: [],
      });

      prices.configured = true;
      prices.failing = true;
      expect((await anonymous().get('/api/deals').expect(200)).body).toMatchObject({
        configured: true,
        available: false,
        items: [],
      });
    });

    it('lists the shops of the configured country', async () => {
      prices.shops = [{ id: 61, name: 'Steam' }];
      const body = (await anonymous().get('/api/deals/shops').expect(200)).body as ShopsResponseDto;
      expect(body.shops).toEqual([{ id: 61, name: 'Steam' }]);
      expect(prices.shopCountries).toEqual(['AR']);
    });

    it('asks for the prices of the requested country, cached per country', async () => {
      prices.deals = [dealItem('g1', 'Portal 2', 4.99, 19.99)];

      const au = (await anonymous().get('/api/deals?country=au').expect(200))
        .body as DealsResponseDto;
      await anonymous().get('/api/deals?country=AU').expect(200);
      const es = (await anonymous().get('/api/deals?country=ES').expect(200))
        .body as DealsResponseDto;
      const shops = (await anonymous().get('/api/deals/shops?country=MX').expect(200))
        .body as ShopsResponseDto;

      expect(au.country).toBe('AU');
      expect(es.country).toBe('ES');
      expect(prices.queries.map((query) => query.country)).toEqual(['AU', 'ES']);
      expect(shops.country).toBe('MX');
      expect(prices.shopCountries).toEqual(['MX']);
      await anonymous().get('/api/deals/shops?country=nope').expect(400);
    });
  });

  describe('GET /api/deals/games/:provider/:externalId', () => {
    const gamePrices = async (path: string, status = 200) =>
      (await anonymous().get(`/api/deals/games/${path}`).expect(status))
        .body as GamePricesResponseDto;

    it("is public and lists the game's current prices per shop, cheapest first", async () => {
      prices.addGame(
        'celeste',
        'Celeste',
        [fakeDeal(9.99, 19.99, { shop: { id: 35, name: 'GOG' } }), fakeDeal(4.99, 19.99)],
        1.99,
      );

      const body = await gamePrices('igdb/200?country=es');

      expect(body).toMatchObject({
        configured: true,
        available: true,
        country: 'ES',
        found: true,
        historyLow: { amount: 1.99, currency: 'USD' },
      });
      expect(body.deals.map((deal) => [deal.shop.name, deal.cut])).toEqual([
        ['Steam', 75],
        ['GOG', 50],
      ]);
      expect(prices.priceCountries).toEqual(['ES']);
    });

    it('says when the source does not have the game', async () => {
      expect(await gamePrices('igdb/300')).toMatchObject({ found: false, deals: [] });
    });

    it('is 404 for games the catalog does not have', async () => {
      await gamePrices('igdb/999', 404);
      await gamePrices('steam/200', 404);
      await anonymous().get('/api/deals/games/igdb/200?country=XX').expect(400);
    });

    it('explains when the source is not configured or fails', async () => {
      prices.addGame('celeste', 'Celeste', [fakeDeal(4.99, 19.99)]);
      prices.configured = false;
      expect(await gamePrices('igdb/200')).toMatchObject({ configured: false, found: false });

      prices.configured = true;
      prices.failing = true;
      expect(await gamePrices('igdb/200')).toMatchObject({
        configured: true,
        available: false,
        found: false,
      });
    });
  });

  describe('wishlist', () => {
    it('requires a session', async () => {
      await anonymous().get('/api/wishlist').expect(401);
      await anonymous()
        .post('/api/wishlist')
        .send({ provider: 'igdb', externalId: '100' })
        .expect(401);
    });

    it('adds catalog games once, with their current prices', async () => {
      catalog.storeIds.set('100', { steamAppId: '367520' });
      prices.steamIds.set('367520', 'hk');
      prices.addGame(
        'hk',
        'ignored: matched by Steam id',
        [fakeDeal(7.49, 14.99), fakeDeal(9.99, 14.99, { shop: { id: 35, name: 'GOG' } })],
        3.74,
      );

      const item = await wish(alice, '100');

      expect(item.game).toMatchObject({
        provider: 'igdb',
        externalId: '100',
        name: 'Hollow Knight',
        coverUrl: expect.stringMatching(/^\/api\/assets\/covers\//),
        platforms: [
          expect.objectContaining({ slug: 'switch' }),
          expect.objectContaining({ slug: 'pc' }),
        ],
      });
      expect(item.targetPrice).toBeNull();
      expect(item.price).toEqual({
        found: true,
        best: expect.objectContaining({ price: { amount: 7.49, currency: 'USD' }, cut: 50 }),
        historyLow: { amount: 3.74, currency: 'USD' },
        reachedTarget: null,
      });

      const duplicate = await as(app, alice)
        .post('/api/wishlist', { provider: 'igdb', externalId: '100' })
        .expect(409);
      expect(duplicate.body).toMatchObject({ code: 'WISHLIST_ITEM_EXISTS' });

      // The catalog page knows it's wishlisted.
      const page = (await as(app, alice).get('/api/catalog/games/igdb/100').expect(200))
        .body as CatalogGameDto;
      expect(page.wishlistItemId).toBe(item.id);
    });

    it('reports games the price source does not have', async () => {
      const item = await wish(alice, '300');
      expect(item.price).toEqual({
        found: false,
        best: null,
        historyLow: null,
        reachedTarget: null,
      });
    });

    it('validates the game reference', async () => {
      await as(app, alice)
        .post('/api/wishlist', { provider: 'igdb', externalId: '404' })
        .expect(404);
      await as(app, alice)
        .post('/api/wishlist', { provider: 'steam', externalId: '1' })
        .expect(400);
      catalog.failing = true;
      await as(app, alice)
        .post('/api/wishlist', { provider: 'igdb', externalId: '100' })
        .expect(503);
    });

    it('sets a target price in the currency of the current prices and tells when it is reached', async () => {
      prices.addGame('celeste', 'Celeste', [fakeDeal(4.99, 19.99)]);
      const item = await wish(alice, '200');

      const above = (
        await as(app, alice).patch(`/api/wishlist/${item.id}`, { targetPrice: 5 }).expect(200)
      ).body as WishlistItemDto;
      expect(above.targetPrice).toEqual({ amount: 5, currency: 'USD' });
      expect(above.price?.reachedTarget).toBe(true);

      const below = (
        await as(app, alice).patch(`/api/wishlist/${item.id}`, { targetPrice: 2.5 }).expect(200)
      ).body as WishlistItemDto;
      expect(below.price?.reachedTarget).toBe(false);

      for (const targetPrice of [0, -1, 1.234, 'cheap', 1_000_000]) {
        await as(app, alice).patch(`/api/wishlist/${item.id}`, { targetPrice }).expect(400);
      }

      const cleared = (
        await as(app, alice).patch(`/api/wishlist/${item.id}`, { targetPrice: null }).expect(200)
      ).body as WishlistItemDto;
      expect(cleared.targetPrice).toBeNull();
    });

    it('refuses a target price when there is no price to compare with', async () => {
      const item = await wish(alice, '300');
      const response = await as(app, alice)
        .patch(`/api/wishlist/${item.id}`, { targetPrice: 5 })
        .expect(409);
      expect(response.body).toMatchObject({ code: 'PRICE_NOT_AVAILABLE' });
    });

    it('keeps working without prices when the source is down', async () => {
      await wish(alice, '200');
      // Prices already fetched stay cached for a while: start without them.
      app.get(DealsService).clearCache();
      prices.failing = true;
      const list = (await as(app, alice).get('/api/wishlist').expect(200))
        .body as WishlistResponseDto;
      expect(list.available).toBe(false);
      expect(list.items).toHaveLength(1);
      expect(list.items[0].price).toBeNull();
    });

    it('prices the wishlist in the requested country', async () => {
      prices.addGame('celeste', 'Celeste', [fakeDeal(4.99, 19.99)]);
      const item = await wish(alice, '200');

      const body = (await as(app, alice).get('/api/wishlist?country=ES').expect(200))
        .body as WishlistResponseDto;
      await as(app, alice).get(`/api/wishlist/${item.id}/history?country=ES`).expect(200);

      expect(body.country).toBe('ES');
      // Adding priced it in the default country; each country has its own prices.
      expect(prices.priceCountries).toEqual(['AR', 'ES']);
      expect(prices.historyCountries).toEqual(['ES']);
      await as(app, alice).get('/api/wishlist?country=XX').expect(400);
    });

    it('shows only real price history', async () => {
      prices.addGame('celeste', 'Celeste', [fakeDeal(4.99, 19.99)]);
      prices.history.set('celeste', [
        {
          timestamp: '2026-08-01T00:00:00.000Z',
          shop: { id: 61, name: 'Steam' },
          price: { amount: 4.99, currency: 'USD' },
          regular: { amount: 19.99, currency: 'USD' },
        },
      ]);
      const item = await wish(alice, '200');
      const history = (await as(app, alice).get(`/api/wishlist/${item.id}/history`).expect(200))
        .body as PriceHistoryResponseDto;
      expect(history.points).toEqual([expect.objectContaining({ cut: 75 })]);

      const noPrices = await wish(alice, '300');
      const empty = (await as(app, alice).get(`/api/wishlist/${noPrices.id}/history`).expect(200))
        .body as PriceHistoryResponseDto;
      expect(empty.points).toEqual([]);
      expect(prices.calls.getHistory).toBe(1);
    });

    it("isolates each user's wishlist", async () => {
      const item = await wish(alice, '100');

      expect(
        ((await as(app, bob).get('/api/wishlist').expect(200)).body as WishlistResponseDto).items,
      ).toEqual([]);
      await as(app, bob).patch(`/api/wishlist/${item.id}`, { targetPrice: null }).expect(404);
      await as(app, bob).get(`/api/wishlist/${item.id}/history`).expect(404);
      await as(app, bob).delete(`/api/wishlist/${item.id}`).expect(404);
      const page = (await as(app, bob).get('/api/catalog/games/igdb/100').expect(200))
        .body as CatalogGameDto;
      expect(page.wishlistItemId).toBeNull();

      // Bob can wishlist the same game.
      await wish(bob, '100');
      await as(app, alice).delete(`/api/wishlist/${item.id}`).expect(204);
      await as(app, alice).delete(`/api/wishlist/${item.id}`).expect(404);
      expect(
        ((await as(app, bob).get('/api/wishlist').expect(200)).body as WishlistResponseDto).items,
      ).toHaveLength(1);
    });

    it('goes away with its user', async () => {
      await wish(alice, '100');
      await dataSource.query('DELETE FROM users WHERE id = $1', [alice.id]);
      expect(await dataSource.query('SELECT 1 FROM wishlist_items')).toHaveLength(0);
    });
  });

  describe('GET /api/deals/recommended', () => {
    it('puts deals of the wishlist and pending games first, then general deals', async () => {
      prices.addGame('hk', 'Hollow Knight', [fakeDeal(7.49, 14.99)]);
      prices.addGame('celeste', 'Celeste', [fakeDeal(19.99, 19.99)]);
      prices.deals = [
        dealItem('hk', 'Hollow Knight', 7.49, 14.99),
        dealItem('g9', 'General', 1, 10),
      ];
      await wish(alice, '100');
      // A pending game with a deal that isn't discounted: not recommended.
      const ps = await dataSource.getRepository(Platform).findOneByOrFail({ slug: 'pc' });
      await as(app, alice)
        .post('/api/library', {
          catalog: { provider: 'igdb', externalId: '200' },
          platformId: ps.id,
        })
        .expect(201);

      const body = (await as(app, alice).get('/api/deals/recommended').expect(200))
        .body as RecommendedDealsResponseDto;

      expect(body.personalized).toBe(true);
      expect(body.items.map((i) => [i.title, i.reason])).toEqual([
        ['Hollow Knight', 'wishlist'],
        ['General', null],
      ]);
      expect(body.items[0].catalogGame).toEqual({ provider: 'igdb', externalId: '100' });

      // Anonymous visitors and Bob only get general deals.
      for (const response of [
        await anonymous().get('/api/deals/recommended').expect(200),
        await as(app, bob).get('/api/deals/recommended').expect(200),
      ]) {
        const general = response.body as RecommendedDealsResponseDto;
        expect(general.personalized).toBe(false);
        expect(general.items.every((i) => i.reason === null)).toBe(true);
      }
    });
  });
});
