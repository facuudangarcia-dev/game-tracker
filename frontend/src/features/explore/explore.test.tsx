import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  mockApi,
  notConfiguredNews,
  notConfiguredPrices,
  testUser,
  unauthenticated,
} from '../../test/mockApi';
import { renderRoute } from '../../test/renderRoute';
import { browserCountry } from './countries';
import { releaseRange } from './releaseRange';
import type { CatalogCard, Deal, NewsArticle, Release, WishlistItem } from './types';

const ps5 = { id: 'p-ps5', slug: 'ps5', name: 'PlayStation 5', shortName: 'PS5', sortOrder: 1 };
const pc = { id: 'p-pc', slug: 'pc', name: 'PC', shortName: 'PC', sortOrder: 2 };
const me = () => ({ status: 200, body: testUser });
const configuredPrices = { ...notConfiguredPrices, configured: true, available: true };

function card(externalId: string, extra: Partial<CatalogCard> = {}): CatalogCard {
  return {
    provider: 'igdb',
    externalId,
    name: `Game ${externalId}`,
    releaseDate: '2025-05-01',
    coverUrl: null,
    artworkUrl: null,
    platforms: [ps5, pc],
    libraryPlatformIds: [],
    wishlistItemId: null,
    ...extra,
  };
}

function discoverPage(games: CatalogCard[], hasMore = false) {
  return { status: 200, body: { games, page: 1, hasMore, catalogAvailable: true } };
}

const deal: Deal = {
  priceGameId: 'g1',
  title: 'Portal 2',
  imageUrl: null,
  shop: { id: 61, name: 'Steam' },
  price: { amount: 4.99, currency: 'USD' },
  regular: { amount: 19.99, currency: 'USD' },
  cut: 75,
  storeLow: null,
  historyLow: null,
  platforms: ['Windows'],
  drm: ['Steam'],
  voucher: null,
  timestamp: '2026-10-09T08:00:00.000Z',
  expiry: null,
  url: 'https://itad.link/portal/',
};

const article: NewsArticle = {
  id: 'n1',
  title: 'Anuncian un nuevo juego de PS5',
  summary: 'Resumen breve.',
  url: 'https://revista.example/nota',
  imageUrl: null,
  source: 'Revista',
  publishedAt: '2026-10-09T10:00:00.000Z',
  categories: ['playstation'],
};

function newsPage(items: NewsArticle[]) {
  return {
    ...notConfiguredNews,
    configured: true,
    available: true,
    sources: ['revista.example'],
    fetchedAt: '2026-10-10T10:00:00.000Z',
    items,
    total: items.length,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Explore navigation', () => {
  it('groups the sections under "Explorar"; the wishlist only with a session', async () => {
    mockApi({
      'GET /auth/me': unauthenticated,
      'GET /deals?country=AR': () => ({
        status: 200,
        body: {
          ...notConfiguredPrices,
          fetchedAt: null,
          items: [],
          hasMore: false,
          nextOffset: null,
        },
      }),
    });
    const { router } = renderRoute('/');

    const nav = await screen.findByRole('navigation', { name: 'Navegación principal' });
    await userEvent.click(within(nav).getByRole('button', { name: 'Explorar' }));
    const menu = screen.getByRole('menu');
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual([
      expect.stringContaining('Descubrir'),
      expect.stringContaining('Lanzamientos'),
      expect.stringContaining('Noticias'),
      expect.stringContaining('Ofertas'),
    ]);
    await userEvent.click(within(menu).getByRole('menuitem', { name: /Ofertas/ }));
    expect(router.state.location.pathname).toBe('/deals');
    expect(
      await screen.findByRole('heading', { name: 'Las ofertas todavía no están configuradas' }),
    ).toBeInTheDocument();
  });

  it('shows the wishlist entry to logged-in users', async () => {
    mockApi({ 'GET /auth/me': me });
    renderRoute('/');
    const nav = await screen.findByRole('navigation', { name: 'Navegación principal' });
    await userEvent.click(within(nav).getByRole('button', { name: 'Explorar' }));
    expect(screen.getByRole('menuitem', { name: /Mi wishlist/ })).toBeInTheDocument();
  });
});

describe('Discover page', () => {
  it('shows recommendations and the catalog with the user presence', async () => {
    mockApi({
      'GET /auth/me': me,
      'GET /catalog/recommendations': () => ({
        status: 200,
        body: {
          personalized: true,
          basedOnGenres: [{ id: 'g', slug: 'role-playing', name: 'Rol (RPG)' }],
          games: [card('10', { name: 'Recomendado' })],
          catalogAvailable: true,
        },
      }),
      'GET /catalog/discover': () =>
        discoverPage([
          card('1', { name: 'Ya lo tengo', libraryPlatformIds: ['p-ps5'] }),
          card('2'),
        ]),
    });
    renderRoute('/discover');

    expect(
      await screen.findByRole('heading', { name: 'Recomendados según tus juegos' }),
    ).toBeVisible();
    expect(screen.getByText(/Rol \(RPG\)/)).toBeInTheDocument();
    const owned = await screen.findByRole('article', { name: 'Ya lo tengo' });
    expect(within(owned).getByText('En tu biblioteca')).toBeInTheDocument();
    // Still addable on its other platform.
    expect(
      within(owned).getByRole('button', { name: 'Agregar Ya lo tengo a Mis juegos' }),
    ).toBeEnabled();
  });

  it('sends the filters to the API and keeps them in the URL', async () => {
    const { calls } = mockApi({
      'GET /auth/me': unauthenticated,
      'GET /platforms': () => ({ status: 200, body: [ps5, pc] }),
      'GET /catalog/discover': () => discoverPage([]),
      'GET /catalog/discover?platform=pc': () => discoverPage([card('5')]),
    });
    const { router } = renderRoute('/discover');

    await screen.findByText('No hay juegos que coincidan con estos filtros.');
    const platform = await screen.findByRole('combobox', { name: 'Plataforma' });
    await screen.findByRole('option', { name: 'PC' });
    await userEvent.selectOptions(platform, 'pc');

    expect(await screen.findByRole('article', { name: 'Game 5' })).toBeInTheDocument();
    expect(router.state.location.search).toBe('?platform=pc');
    expect(calls.some((call) => call.path === '/catalog/discover?platform=pc')).toBe(true);
  });

  it('asks anonymous visitors to log in to add or save a game', async () => {
    mockApi({
      'GET /auth/me': unauthenticated,
      'GET /catalog/discover': () => discoverPage([card('1')]),
    });
    const { router } = renderRoute('/discover');

    const game = await screen.findByRole('article', { name: 'Game 1' });
    await userEvent.click(
      within(game).getByRole('button', { name: 'Agregar Game 1 a tu wishlist' }),
    );
    expect(router.state.location.pathname).toBe('/login');
  });

  it('adds a game to the wishlist from its card', async () => {
    let saved = false;
    const { calls } = mockApi({
      'GET /auth/me': me,
      'GET /catalog/discover': () =>
        discoverPage([card('1', { wishlistItemId: saved ? 'w-1' : null })]),
      'POST /wishlist?country=AR': () => {
        saved = true;
        return { status: 201, body: {} };
      },
    });
    renderRoute('/discover');

    const game = await screen.findByRole('article', { name: 'Game 1' });
    await userEvent.click(
      within(game).getByRole('button', { name: 'Agregar Game 1 a tu wishlist' }),
    );
    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({
      provider: 'igdb',
      externalId: '1',
    });
    expect(
      await within(game).findByRole('button', { name: 'Quitar Game 1 de tu wishlist' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('Releases page', () => {
  it('computes the ranges of each view', () => {
    const today = new Date(2026, 9, 10);
    expect(releaseRange('week', 0, null, today)).toEqual({ from: '2026-10-10', to: '2026-10-16' });
    expect(releaseRange('week', -1, null, today)).toEqual({ from: '2026-10-03', to: '2026-10-09' });
    expect(releaseRange('recent', 0, null, today)).toEqual({
      from: '2026-09-10',
      to: '2026-10-09',
    });
    expect(releaseRange('month', 0, '2027-02', today)).toEqual({
      from: '2027-02-01',
      to: '2027-02-28',
    });
    expect(releaseRange('quarter', 1, null, today)).toEqual({
      from: '2027-01-01',
      to: '2027-03-31',
    });
  });

  it('tells confirmed dates from estimated ones and lists games without a date', async () => {
    const release = (id: string, date: string, precision: Release['precision']): Release => ({
      ...card(id),
      date,
      precision,
      releasePlatforms: [ps5],
    });
    const releases = (list: Release[]) => ({
      status: 200,
      body: { releases: list, catalogAvailable: true },
    });
    const { calls } = mockApi({
      'GET /auth/me': unauthenticated,
      'GET /catalog/releases/undated': () => ({
        status: 200,
        body: {
          games: [card('99', { name: 'Sin fecha', releaseDate: null })],
          catalogAvailable: true,
        },
      }),
      'GET /catalog/releases?from=2026-10-01&to=2026-10-31': () =>
        releases([release('1', '2026-10-12', 'day'), release('2', '2026-10-01', 'month')]),
      'GET /catalog/releases?from=2026-11-01&to=2026-11-30': () => releases([]),
    });
    renderRoute('/releases?view=month&month=2026-10');

    const confirmed = await screen.findByRole('region', { name: /12 de octubre de 2026/ });
    expect(within(confirmed).getByText(/Fecha confirmada/)).toBeInTheDocument();
    const estimated = screen.getByRole('region', { name: 'Octubre de 2026 (fecha estimada)' });
    expect(within(estimated).getByRole('article', { name: 'Game 2' })).toBeInTheDocument();
    expect(await screen.findByRole('article', { name: 'Sin fecha' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Período siguiente' }));
    expect(
      await screen.findByText('No hay lanzamientos destacados en este período con estos filtros.'),
    ).toBeInTheDocument();
    expect(calls.some((call) => call.path.startsWith('/catalog/releases?from=2026-11-01'))).toBe(
      true,
    );
  });
});

describe('News page', () => {
  it('explains how to configure the feeds', async () => {
    mockApi({ 'GET /auth/me': unauthenticated });
    renderRoute('/news');
    expect(
      await screen.findByRole('heading', { name: 'Las noticias todavía no están configuradas' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/NEWS_RSS_FEEDS/)).toBeInTheDocument();
  });

  it('links each headline to the original article and filters by platform', async () => {
    const { calls } = mockApi({
      'GET /auth/me': unauthenticated,
      'GET /news?lang=es': () => ({ status: 200, body: newsPage([article]) }),
      'GET /news?lang=es&category=xbox': () => ({ status: 200, body: newsPage([]) }),
    });
    renderRoute('/news');

    const link = await screen.findByRole('link', { name: /Anuncian un nuevo juego de PS5/ });
    expect(link).toHaveAttribute('href', 'https://revista.example/nota');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByText('Fuentes: revista.example')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: 'Xbox' }));
    expect(
      await screen.findByText('No hay noticias que coincidan con la búsqueda.'),
    ).toBeInTheDocument();
    expect(calls.some((call) => call.path === '/news?lang=es&category=xbox')).toBe(true);
  });

  it('says when the news are in the other language (no outlets in this one)', async () => {
    mockApi({
      'GET /auth/me': unauthenticated,
      'GET /news?lang=es': () => ({
        status: 200,
        body: { ...newsPage([article]), language: 'en' },
      }),
    });
    renderRoute('/news');
    expect(
      await screen.findByText(
        'Todavía no hay medios en español configurados: se muestran noticias en inglés.',
      ),
    ).toBeInTheDocument();
  });
});

describe('Country of prices', () => {
  const dealsIn = (country: string) => ({
    status: 200,
    body: {
      ...configuredPrices,
      country,
      fetchedAt: '2026-10-10T10:00:00.000Z',
      items: [deal],
      hasMore: false,
      nextOffset: null,
    },
  });
  const shopsIn = (country: string) => ({
    status: 200,
    body: { ...configuredPrices, country, shops: [] },
  });

  it('comes from the browser region when none was chosen', () => {
    expect(browserCountry(['en-AU', 'en'])).toBe('AU');
    expect(browserCountry(['es', 'es-419', 'pt-BR'])).toBe('BR');
    expect(browserCountry(['es', 'en'])).toBeNull();
  });

  it("is remembered in a visitor's browser", async () => {
    const { calls } = mockApi({
      'GET /auth/me': unauthenticated,
      'GET /deals?country=AR': () => dealsIn('AR'),
      'GET /deals/shops?country=AR': () => shopsIn('AR'),
      'GET /deals?country=AU': () => dealsIn('AU'),
      'GET /deals/shops?country=AU': () => shopsIn('AU'),
    });
    renderRoute('/deals');
    await screen.findByRole('link', { name: /Portal 2/ });
    expect(screen.getByText(/Precios para Argentina/)).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'País' }), 'AU');

    expect(await screen.findByText(/Precios para Australia/)).toBeInTheDocument();
    expect(calls.some((call) => call.path === '/deals?country=AU')).toBe(true);
    expect(calls.some((call) => call.method === 'PUT')).toBe(false);
    expect(window.localStorage.getItem('gt.priceCountry')).toBe('AU');
  });

  it("uses and saves the country of the user's profile", async () => {
    const { calls } = mockApi({
      'GET /auth/me': () => ({ status: 200, body: { ...testUser, country: 'ES' } }),
      'GET /deals?country=ES': () => dealsIn('ES'),
      'GET /deals/shops?country=ES': () => shopsIn('ES'),
      'PUT /profile/country': (request) => ({
        status: 200,
        body: { ...testUser, ...(request.body as object) },
      }),
      'GET /deals?country=MX': () => dealsIn('MX'),
      'GET /deals/shops?country=MX': () => shopsIn('MX'),
    });
    renderRoute('/deals');
    expect(await screen.findByText(/Precios para España/)).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'País' }), 'MX');

    expect(await screen.findByText(/Precios para México/)).toBeInTheDocument();
    expect(calls.find((call) => call.method === 'PUT')?.body).toEqual({ country: 'MX' });
    expect(window.localStorage.getItem('gt.priceCountry')).toBeNull();
  });
});

describe('Deals page', () => {
  const dealsPage = (items: Deal[]) => ({
    status: 200,
    body: {
      ...configuredPrices,
      fetchedAt: '2026-10-10T10:00:00.000Z',
      items,
      hasMore: false,
      nextOffset: null,
    },
  });

  it('shows real prices, the computed discount and the source; no invented history low', async () => {
    mockApi({
      'GET /auth/me': unauthenticated,
      'GET /deals?country=AR': () => dealsPage([deal]),
      'GET /deals/shops?country=AR': () => ({
        status: 200,
        body: { ...configuredPrices, shops: [] },
      }),
    });
    renderRoute('/deals');

    const link = await screen.findByRole('link', { name: /Portal 2/ });
    expect(link).toHaveAttribute('href', 'https://itad.link/portal/');
    expect(within(link).getByLabelText('75 % de descuento')).toBeInTheDocument();
    expect(within(link).getByLabelText(/Precio anterior/)).toBeInTheDocument();
    expect(within(link).queryByText(/Mínimo histórico/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'IsThereAnyDeal' })).toHaveAttribute(
      'href',
      'https://isthereanydeal.com',
    );
  });

  it('sorts by the biggest discount', async () => {
    const { calls } = mockApi({
      'GET /auth/me': unauthenticated,
      'GET /deals?country=AR': () => dealsPage([deal]),
      'GET /deals?country=AR&sort=cut': () => dealsPage([]),
      'GET /deals/shops?country=AR': () => ({
        status: 200,
        body: { ...configuredPrices, shops: [] },
      }),
    });
    renderRoute('/deals');
    await screen.findByRole('link', { name: /Portal 2/ });
    await userEvent.click(screen.getByRole('radio', { name: 'Mayor descuento' }));
    expect(
      await screen.findByText('No hay ofertas que coincidan con estos filtros.'),
    ).toBeInTheDocument();
    expect(calls.some((call) => call.path === '/deals?country=AR&sort=cut')).toBe(true);
  });

  it('filters by type, showing everything by default', async () => {
    const { calls } = mockApi({
      'GET /auth/me': unauthenticated,
      'GET /deals?country=AR': () => dealsPage([deal]),
      'GET /deals?country=AR&type=dlc': () => dealsPage([]),
      'GET /deals/shops?country=AR': () => ({
        status: 200,
        body: { ...configuredPrices, shops: [] },
      }),
    });
    renderRoute('/deals');
    await screen.findByRole('link', { name: /Portal 2/ });
    const type = screen.getByLabelText('Tipo');
    expect(type).toHaveValue('');
    expect(
      within(type)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Todo', 'Juegos', 'DLC', 'Otros']);
    await userEvent.selectOptions(type, 'DLC');
    expect(
      await screen.findByText('No hay ofertas que coincidan con estos filtros.'),
    ).toBeInTheDocument();
    expect(calls.some((call) => call.path === '/deals?country=AR&type=dlc')).toBe(true);
  });
});

describe('Wishlist page', () => {
  const item = (extra: Partial<WishlistItem> = {}): WishlistItem => ({
    id: 'w-1',
    createdAt: '2026-10-01T10:00:00.000Z',
    game: {
      gameId: 'g-1',
      provider: 'igdb',
      externalId: '100',
      name: 'Hollow Knight',
      coverUrl: null,
      releaseDate: '2017-02-24',
      platforms: [pc],
    },
    targetPrice: null,
    price: {
      found: true,
      best: {
        ...deal,
        price: { amount: 7.49, currency: 'USD' },
        regular: { amount: 14.99, currency: 'USD' },
        cut: 50,
      },
      historyLow: { amount: 3.74, currency: 'USD' },
      reachedTarget: null,
    },
    ...extra,
  });

  it('requires a session', async () => {
    mockApi({ 'GET /auth/me': unauthenticated });
    const { router } = renderRoute('/wishlist');
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });

  it('sets a target price in the source currency and shows when it is reached', async () => {
    const { calls } = mockApi({
      'GET /auth/me': me,
      'GET /wishlist?country=AR': () => ({
        status: 200,
        body: { ...configuredPrices, items: [item()] },
      }),
      'PATCH /wishlist/w-1?country=AR': () => ({
        status: 200,
        body: item({
          targetPrice: { amount: 8, currency: 'USD' },
          price: { ...item().price!, reachedTarget: true },
        }),
      }),
    });
    renderRoute('/wishlist');

    const row = await screen.findByRole('article', { name: 'Hollow Knight' });
    expect(within(row).getByText(/Mínimo histórico según la fuente/)).toBeInTheDocument();
    const input = within(row).getByRole('textbox', { name: 'Precio objetivo (USD)' });
    await userEvent.type(input, '0');
    await userEvent.click(within(row).getByRole('button', { name: 'Guardar' }));
    expect(
      within(row).getByText('Ingresá un precio mayor a 0 con hasta 2 decimales.'),
    ).toBeInTheDocument();

    await userEvent.clear(input);
    await userEvent.type(input, '8');
    await userEvent.click(within(row).getByRole('button', { name: 'Guardar' }));
    expect(await within(row).findByText('¡Alcanzó tu precio objetivo!')).toBeInTheDocument();
    expect(calls.find((call) => call.method === 'PATCH')?.body).toEqual({ targetPrice: 8 });
  });

  it('only shows real price history', async () => {
    mockApi({
      'GET /auth/me': me,
      'GET /wishlist?country=AR': () => ({
        status: 200,
        body: { ...configuredPrices, items: [item()] },
      }),
      'GET /wishlist/w-1/history?country=AR': () => ({
        status: 200,
        body: { ...configuredPrices, points: [] },
      }),
    });
    renderRoute('/wishlist');

    await userEvent.click(await screen.findByRole('button', { name: 'Historial de precios' }));
    expect(
      await screen.findByText('La fuente no tiene historial de precios de este juego.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('invites to discover games when empty', async () => {
    mockApi({
      'GET /auth/me': me,
      'GET /wishlist?country=AR': () => ({ status: 200, body: { ...configuredPrices, items: [] } }),
    });
    renderRoute('/wishlist');
    expect(
      await screen.findByRole('heading', { name: 'Tu wishlist está vacía' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir a Descubrir' })).toHaveAttribute(
      'href',
      '/discover',
    );
  });
});

describe('Home modules', () => {
  it('shows recommended deals and news, linking to their pages', async () => {
    mockApi({
      'GET /auth/me': me,
      'GET /news?lang=es': () => ({ status: 200, body: newsPage([article]) }),
      'GET /deals/recommended?country=AR': () => ({
        status: 200,
        body: {
          ...configuredPrices,
          personalized: true,
          items: [
            { ...deal, reason: 'wishlist', catalogGame: { provider: 'igdb', externalId: '1' } },
          ],
        },
      }),
    });
    renderRoute('/');

    const deals = (await screen.findByRole('heading', { name: 'Ofertas recomendadas' })).closest(
      'section',
    ) as HTMLElement;
    expect(await within(deals).findByText('De tu wishlist')).toBeInTheDocument();
    expect(within(deals).getByRole('link', { name: 'Ver todo' })).toHaveAttribute('href', '/deals');
    const news = (
      await screen.findByRole('heading', { name: 'Lo último del mundo gamer' })
    ).closest('section') as HTMLElement;
    expect(within(news).getByRole('link', { name: /Anuncian un nuevo juego/ })).toBeInTheDocument();
  });

  it('hides them when the sources are not configured', async () => {
    mockApi({ 'GET /auth/me': me });
    renderRoute('/');
    await screen.findByRole('heading', { name: 'Juegos recomendados' });
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Ofertas recomendadas' }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.queryByRole('heading', { name: 'Lo último del mundo gamer' }),
    ).not.toBeInTheDocument();
  });
});
