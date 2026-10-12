import { discountPercent, PriceUnavailableError } from '../price-provider';
import { type FetchFn, ITAD_API_URL, ItadProvider, parseDeal, safeUrl } from './itad.provider';

const KEY = 'test-itad-key';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function setup(...responses: Response[]) {
  const fetchMock = jest.fn<Promise<Response>, Parameters<FetchFn>>(() =>
    Promise.resolve(responses.shift() ?? json([])),
  );
  return { provider: new ItadProvider(KEY, fetchMock as FetchFn), fetchMock };
}

const money = (amount: number, currency = 'USD') => ({
  amount,
  amountInt: Math.round(amount * 100),
  currency,
});

const rawDeal = {
  shop: { id: 61, name: 'Steam' },
  price: money(4.99),
  regular: money(19.99),
  cut: 75,
  voucher: null,
  storeLow: money(3.99),
  historyLow: money(2.99),
  flag: 'H',
  drm: [{ id: 61, name: 'Steam' }],
  platforms: [
    { id: 1, name: 'Windows' },
    { id: 3, name: 'Linux' },
  ],
  timestamp: '2026-10-09T10:00:00+02:00',
  expiry: '2026-10-20T17:00:00+02:00',
  url: 'https://itad.link/abc/',
};

const entry = (id: string, type: string | null) => ({
  id: `018d937f-11fd-7311-a4a8-${id.padStart(12, '0')}`,
  title: `Game ${id}`,
  type,
  assets: {},
  deal: rawDeal,
});

describe('ItadProvider', () => {
  it('fills a page of one kind by scanning the source, continuing after the last shown', async () => {
    const { provider, fetchMock } = setup(
      json({
        hasMore: true,
        nextOffset: 210,
        list: [entry('1', 'dlc'), entry('2', 'game'), entry('3', null), entry('4', 'package')],
      }),
      json({
        hasMore: true,
        nextOffset: 410,
        list: [entry('5', 'game'), entry('6', 'dlc'), entry('7', 'game')],
      }),
    );
    const query = {
      country: 'AR',
      sort: 'relevance' as const,
      shopIds: [],
      platform: null,
      minCut: null,
      minPrice: null,
      maxPrice: null,
      offset: 10,
      limit: 3,
    };

    // Games include packages; the page ends at the 3rd game (index 0 of the 2nd chunk).
    const games = await provider.listDeals({ ...query, type: 'game' });
    expect(games.items.map((item) => item.title)).toEqual(['Game 2', 'Game 4', 'Game 5']);
    expect(games).toMatchObject({ hasMore: true, nextOffset: 211 });
    const offsets = fetchMock.mock.calls.map(([url]) => new URL(url as string).searchParams);
    expect(offsets.map((p) => [p.get('offset'), p.get('limit')])).toEqual([
      ['10', '200'],
      ['210', '200'],
    ]);

    // "Other" is what the source doesn't classify; the end of the source ends the list.
    const last = setup(json({ hasMore: false, list: [entry('8', 'game'), entry('9', null)] }));
    const others = await last.provider.listDeals({ ...query, type: 'other' });
    expect(others.items.map((item) => [item.title, item.kind])).toEqual([['Game 9', 'other']]);
    expect(others).toMatchObject({ hasMore: false, nextOffset: null });
  });

  it('stops scanning after a few requests, returning what it found', async () => {
    const dlcOnly = () =>
      json({ hasMore: true, nextOffset: 0, list: [entry('1', 'dlc'), entry('2', 'dlc')] });
    const { provider, fetchMock } = setup(dlcOnly(), dlcOnly(), dlcOnly(), dlcOnly(), dlcOnly());
    const page = await provider.listDeals({
      country: 'AR',
      sort: 'relevance',
      shopIds: [],
      platform: null,
      type: 'game',
      minCut: null,
      minPrice: null,
      maxPrice: null,
      offset: 0,
      limit: 24,
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(page).toMatchObject({ items: [], hasMore: true });
  });

  it('lists deals with filters, sending the key only in a header', async () => {
    const { provider, fetchMock } = setup(
      json({
        nextOffset: 24,
        hasMore: true,
        list: [
          {
            id: '018d937f-11fd-7311-a4a8-8b1f9b6e2d4b',
            slug: 'portal-2',
            title: 'Portal 2',
            type: 'game',
            mature: false,
            assets: {
              boxart: 'https://assets.isthereanydeal.com/box.jpg',
              banner400: 'http://x/b.jpg',
            },
            deal: rawDeal,
          },
          { id: 'broken', title: 'No deal' },
        ],
      }),
    );

    const page = await provider.listDeals({
      country: 'AU',
      sort: 'cut',
      shopIds: [61, 35],
      platform: 'linux',
      type: null,
      minCut: 50,
      minPrice: null,
      maxPrice: 10,
      offset: 0,
      limit: 24,
    });

    const [url, init] = fetchMock.mock.calls[0];
    const parsed = new URL(url as string);
    expect(parsed.origin + parsed.pathname).toBe(`${ITAD_API_URL}/deals/v2`);
    expect(parsed.searchParams.get('country')).toBe('AU');
    expect(parsed.searchParams.get('sort')).toBe('-cut');
    expect(parsed.searchParams.get('shops')).toBe('61,35');
    expect(JSON.parse(parsed.searchParams.get('filter')!)).toEqual({
      cut: { min: 50, max: null },
      price: { min: null, max: 10 },
      platform: [3],
    });
    expect(url).not.toContain(KEY);
    expect((init?.headers as Record<string, string>)['ITAD-API-Key']).toBe(KEY);

    expect(page.hasMore).toBe(true);
    expect(page.nextOffset).toBe(24);
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      title: 'Portal 2',
      // The http banner is skipped: only https images.
      imageUrl: 'https://assets.isthereanydeal.com/box.jpg',
      deal: {
        shop: { id: 61, name: 'Steam' },
        price: { amount: 4.99, currency: 'USD' },
        platforms: ['Windows', 'Linux'],
        expiry: '2026-10-20T15:00:00.000Z',
      },
    });
  });

  it('sorts relevance by popularity rank and omits the filter when there is none', async () => {
    const { provider, fetchMock } = setup(json({ list: [], hasMore: false }));
    await provider.listDeals({
      country: 'AR',
      sort: 'relevance',
      shopIds: [],
      platform: null,
      type: null,
      minCut: null,
      minPrice: null,
      maxPrice: null,
      offset: 0,
      limit: 24,
    });
    const parsed = new URL(fetchMock.mock.calls[0][0] as string);
    expect(parsed.searchParams.get('sort')).toBe('rank');
    expect(parsed.searchParams.has('filter')).toBe(false);
  });

  it('looks games up by Steam app id, else by exact title', async () => {
    const id = '018d937f-11fd-7311-a4a8-8b1f9b6e2d4b';
    const { provider, fetchMock } = setup(
      json({ 'app/620': id, 'app/1': null }),
      json({ Celeste: '018d937f-0000-7311-a4a8-8b1f9b6e2d4b', Nope: 'not-a-uuid' }),
    );

    const ids = await provider.findGameIds([
      { key: 'a', steamAppId: '620', title: 'Portal 2' },
      { key: 'b', steamAppId: '1', title: 'Unknown' },
      { key: 'c', steamAppId: null, title: 'Celeste' },
      { key: 'd', steamAppId: null, title: 'Nope' },
    ]);

    expect(fetchMock.mock.calls[0][0]).toBe(`${ITAD_API_URL}/lookup/id/shop/61/v1`);
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual(['app/620', 'app/1']);
    expect(fetchMock.mock.calls[1][0]).toBe(`${ITAD_API_URL}/lookup/id/title/v1`);
    expect([...ids.entries()]).toEqual([
      ['a', id],
      ['b', null],
      ['c', '018d937f-0000-7311-a4a8-8b1f9b6e2d4b'],
      ['d', null],
    ]);
  });

  it('returns current prices cheapest first with the history low', async () => {
    const { provider, fetchMock } = setup(
      json([
        {
          id: 'g1',
          historyLow: { all: money(1.99), y1: money(2.99), m3: null },
          deals: [
            {
              ...rawDeal,
              shop: { id: 35, name: 'GOG' },
              price: money(9.99),
              historyLow: undefined,
            },
            rawDeal,
            { ...rawDeal, url: 'javascript:alert(1)' },
          ],
        },
      ]),
    );

    const prices = await provider.getPrices(['g1', 'g1'], 'MX');

    expect(fetchMock.mock.calls[0][0]).toBe(`${ITAD_API_URL}/games/prices/v3?country=MX`);
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual(['g1']);
    const game = prices.get('g1')!;
    expect(game.historyLow).toEqual({ amount: 1.99, currency: 'USD' });
    expect(game.deals.map((d) => d.shop.name)).toEqual(['Steam', 'GOG']);
    expect(game.deals[1].historyLow).toEqual({ amount: 1.99, currency: 'USD' });
  });

  it('returns the real price history, oldest first', async () => {
    const { provider, fetchMock } = setup(
      json([
        {
          timestamp: '2026-09-01T00:00:00Z',
          shop: { id: 61, name: 'Steam' },
          deal: { price: money(19.99), regular: money(19.99), cut: 0 },
        },
        {
          timestamp: '2026-08-01T00:00:00Z',
          shop: { id: 61, name: 'Steam' },
          deal: { price: money(4.99), regular: money(19.99), cut: 75 },
        },
        { timestamp: 'nope', shop: { id: 61, name: 'Steam' }, deal: { price: money(1) } },
      ]),
    );

    const points = await provider.getHistory('g1', new Date('2025-10-10T00:00:00Z'), 'ES');

    const parsed = new URL(fetchMock.mock.calls[0][0] as string);
    expect(parsed.pathname).toBe('/games/history/v2');
    expect(parsed.searchParams.get('since')).toBe('2025-10-10T00:00:00.000Z');
    expect(parsed.searchParams.get('country')).toBe('ES');
    expect(points.map((p) => p.price.amount)).toEqual([4.99, 19.99]);
  });

  it('turns errors into PriceUnavailableError without the key or the body', async () => {
    const { provider } = setup(json({ error: 'secret details' }, 429));
    const error = await provider.listShops('AR').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PriceUnavailableError);
    expect((error as Error).message).toBe(
      'IsThereAnyDeal request to "/service/shops/v1" failed with status 429',
    );
    expect((error as Error).message).not.toContain(KEY);
  });

  it('is unavailable without a key and never calls the API', async () => {
    const fetchMock = jest.fn();
    const provider = new ItadProvider(null, fetchMock);
    expect(provider.isConfigured).toBe(false);
    await expect(provider.listShops('AR')).rejects.toBeInstanceOf(PriceUnavailableError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('parseDeal', () => {
  it('rejects deals with missing or inconsistent prices', () => {
    expect(parseDeal(rawDeal)).not.toBeNull();
    expect(parseDeal({ ...rawDeal, price: { amount: -1, currency: 'USD' } })).toBeNull();
    expect(parseDeal({ ...rawDeal, price: money(4.99, 'ARS') })).toBeNull();
    expect(parseDeal({ ...rawDeal, regular: undefined })).toBeNull();
    expect(parseDeal({ ...rawDeal, shop: { id: 'x', name: 'Steam' } })).toBeNull();
    expect(parseDeal({ ...rawDeal, timestamp: 'yesterday' })).toBeNull();
    expect(parseDeal({ ...rawDeal, url: 'http://itad.link/abc/' })).toBeNull();
  });

  it('only accepts https URLs', () => {
    expect(safeUrl('https://example.com/a.jpg')).toBe('https://example.com/a.jpg');
    expect(safeUrl('http://example.com/a.jpg')).toBeNull();
    expect(safeUrl('data:image/png;base64,AAAA')).toBeNull();
    expect(safeUrl(42)).toBeNull();
  });
});

describe('discountPercent', () => {
  it('is computed from the real prices and never overstated', () => {
    expect(
      discountPercent({ amount: 4.99, currency: 'USD' }, { amount: 19.99, currency: 'USD' }),
    ).toBe(75);
    expect(discountPercent({ amount: 10, currency: 'USD' }, { amount: 10, currency: 'USD' })).toBe(
      0,
    );
    expect(
      discountPercent({ amount: 5, currency: 'USD' }, { amount: 10, currency: 'EUR' }),
    ).toBeNull();
    expect(
      discountPercent({ amount: 12, currency: 'USD' }, { amount: 10, currency: 'USD' }),
    ).toBeNull();
    expect(
      discountPercent({ amount: 0, currency: 'USD' }, { amount: 0, currency: 'USD' }),
    ).toBeNull();
  });
});
