import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockApi, testUser } from '../../test/mockApi';
import { renderRoute } from '../../test/renderRoute';
import type { CatalogGame, CatalogSearchResult, Platform } from '../library/types';

const ps4: Platform = { id: 'p-ps4', slug: 'ps4', name: 'PlayStation 4', shortName: 'PS4' };
const ps5: Platform = { id: 'p-ps5', slug: 'ps5', name: 'PlayStation 5', shortName: 'PS5' };

const spiderMan: CatalogGame = {
  gameId: null,
  provider: 'igdb',
  externalId: '1001',
  name: "Marvel's Spider-Man",
  summary: 'Be Spider-Man.',
  releaseDate: '2018-09-07',
  coverUrl: '/api/catalog/igdb/images/cospidey?size=cover',
  platforms: [ps5, ps4],
  genres: [
    { id: 'gen-adv', slug: 'adventure', name: 'Aventura' },
    { id: null, slug: null, name: 'Superhero' },
  ],
  developers: ['Insomniac Games'],
  publishers: ['Sony Interactive Entertainment'],
  libraryEntries: [],
};

const result = (overrides: Partial<CatalogSearchResult>): CatalogSearchResult => ({
  gameId: null,
  provider: 'igdb',
  externalId: '1001',
  name: "Marvel's Spider-Man",
  releaseDate: '2018-09-07',
  coverUrl: null,
  platforms: [ps5, ps4],
  isManual: false,
  ...overrides,
});

const me = () => ({ status: 200, body: testUser });
const createdGame = { status: 201, body: { id: 'ug-new' } };

function setup(handlers: Parameters<typeof mockApi>[0] = {}, path = '/') {
  const api = mockApi({ 'GET /auth/me': me, ...handlers });
  return { ...api, ...renderRoute(path) };
}

describe('navigation, home and profile', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the Home at / with entry points, not a dashboard', async () => {
    setup();

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Tu historial personal de videojuegos',
      }),
    ).toBeInTheDocument();
    const main = screen.getByRole('main');
    expect(within(main).getByRole('button', { name: 'Explorar juegos' })).toBeInTheDocument();
    expect(within(main).getByRole('link', { name: 'Mis juegos' })).toHaveAttribute(
      'href',
      '/games',
    );
  });

  it('has a compact navigation with Inicio, Mis juegos and Mi perfil', async () => {
    const { router } = setup();

    const nav = await screen.findByRole('navigation', { name: 'Navegación principal' });
    expect(within(nav).getByRole('link', { name: 'Inicio' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await userEvent.click(within(nav).getByRole('link', { name: 'Mis juegos' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/games'));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Mis juegos' }),
    ).toBeInTheDocument();

    await userEvent.click(within(nav).getByRole('link', { name: 'Mi perfil' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/profile'));
  });

  it('focuses the global search from "Explorar juegos"', async () => {
    setup();

    await userEvent.click(await screen.findByRole('button', { name: 'Explorar juegos' }));

    expect(screen.getByRole('combobox', { name: 'Buscar juegos' })).toHaveFocus();
  });

  it('shows the profile with the email and a way to log out', async () => {
    const { router } = setup({ 'POST /auth/logout': () => ({ status: 204 }) }, '/profile');

    expect(await screen.findByRole('heading', { level: 1, name: 'Mi perfil' })).toBeInTheDocument();
    const main = screen.getByRole('main');
    expect(within(main).getByText(testUser.email)).toBeInTheDocument();

    await userEvent.click(within(main).getByRole('button', { name: 'Cerrar sesión' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });
});

describe('global catalog search', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('searches the catalog, hides manual games and opens the catalog page', async () => {
    const { router, calls } = setup({
      'GET /catalog/search?q=spider': () => ({
        status: 200,
        body: {
          catalogAvailable: true,
          results: [
            result({}),
            result({ externalId: '1002', name: "Marvel's Spider-Man 2", platforms: [ps5] }),
            result({
              gameId: 'g-manual',
              provider: null,
              externalId: null,
              name: 'Spider homebrew',
              isManual: true,
              platforms: [],
            }),
          ],
        },
      }),
      'GET /catalog/games/igdb/1002': () => ({
        status: 200,
        body: { ...spiderMan, externalId: '1002', name: "Marvel's Spider-Man 2" },
      }),
    });

    await userEvent.type(await screen.findByRole('combobox', { name: 'Buscar juegos' }), 'spider');

    const listbox = await screen.findByRole('listbox');
    const options = within(listbox).getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual([
      "Marvel's Spider-Man (2018)PS5 · PS4",
      "Marvel's Spider-Man 2 (2018)PS5",
    ]);
    expect(within(listbox).queryByText('Spider homebrew')).not.toBeInTheDocument();

    await userEvent.click(options[1]);
    await waitFor(() => expect(router.state.location.pathname).toBe('/catalog/igdb/1002'));
    expect(
      await screen.findByRole('heading', { level: 1, name: /Marvel's Spider-Man 2/ }),
    ).toBeInTheDocument();
    // Opening a game never adds it.
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });
});

describe('catalog game page', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const openCatalogPage = (game: CatalogGame, handlers: Parameters<typeof mockApi>[0] = {}) =>
    setup(
      { 'GET /catalog/games/igdb/1001': () => ({ status: 200, body: game }), ...handlers },
      '/catalog/igdb/1001',
    );

  it('shows the information about the game', async () => {
    openCatalogPage(spiderMan);

    expect(
      await screen.findByRole('heading', { level: 1, name: /^Marvel's Spider-Man\s*\(2018\)$/ }),
    ).toBeInTheDocument();
    const info = screen.getByRole('region', { name: 'Información del juego' });
    expect(screen.getByText('Be Spider-Man.')).toBeInTheDocument();
    expect(within(info).getByText('PlayStation 5')).toBeInTheDocument();
    expect(within(info).getByText('Aventura')).toBeInTheDocument();
    expect(within(info).getByText('Superhero')).toBeInTheDocument();
    expect(within(info).getByText('Sony Interactive Entertainment')).toBeInTheDocument();
    expect(within(info).getByText('07/09/2018')).toBeInTheDocument();
    // It is not the personal page: no playthroughs, sessions, platinum...
    expect(screen.queryByRole('heading', { name: 'Partidas' })).not.toBeInTheDocument();
  });

  it('adds the game with the chosen settings and opens "Mi juego"', async () => {
    const { calls, router } = openCatalogPage(spiderMan, {
      'POST /library': () => createdGame,
      'GET /library/ug-new': () => ({ status: 404, body: {} }),
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Agregar juego' }));
    const dialog = await screen.findByRole('dialog', { name: 'Agregar juego' });

    // Only the platforms the catalog reports for this game.
    const platformSelect = within(dialog).getByLabelText(/Plataforma/);
    expect(
      within(platformSelect)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Elegí una plataforma', 'PlayStation 5', 'PlayStation 4']);
    expect(within(platformSelect).queryByText('PC')).not.toBeInTheDocument();

    await userEvent.selectOptions(platformSelect, 'PlayStation 4');
    await userEvent.selectOptions(within(dialog).getByLabelText('Estado inicial'), 'En progreso');
    await userEvent.type(within(dialog).getByLabelText('Fecha de inicio (opcional)'), '2026-01-10');
    await userEvent.selectOptions(within(dialog).getByLabelText('Dificultad'), 'Difícil');
    await userEvent.type(within(dialog).getByLabelText(/Valoración/), '87');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Agregar juego' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/games/ug-new'));
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({
      catalog: { provider: 'igdb', externalId: '1001' },
      platformId: ps4.id,
      initialPlaythrough: {
        status: 'IN_PROGRESS',
        startDate: '2026-01-10',
        completionDate: null,
        difficulty: 'Difícil',
      },
      rating: 87,
    });
  });

  it('reuses an already imported game by its id', async () => {
    const { calls } = openCatalogPage(
      { ...spiderMan, gameId: 'g-1' },
      {
        'POST /library': () => createdGame,
        'GET /library/ug-new': () => ({ status: 404, body: {} }),
      },
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Agregar juego' }));
    const dialog = await screen.findByRole('dialog', { name: 'Agregar juego' });
    await userEvent.selectOptions(within(dialog).getByLabelText(/Plataforma/), 'PlayStation 5');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Agregar juego' }));

    await waitFor(() =>
      expect(calls.find((c) => c.method === 'POST')?.body).toMatchObject({
        gameId: 'g-1',
        platformId: ps5.id,
      }),
    );
  });

  it('requires a completion date when adding it as completed', async () => {
    const { calls } = openCatalogPage(spiderMan);

    await userEvent.click(await screen.findByRole('button', { name: 'Agregar juego' }));
    const dialog = await screen.findByRole('dialog', { name: 'Agregar juego' });
    await userEvent.selectOptions(within(dialog).getByLabelText(/Plataforma/), 'PlayStation 5');
    await userEvent.selectOptions(within(dialog).getByLabelText('Estado inicial'), 'Completado');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Agregar juego' }));

    expect(
      within(dialog).getByText('Una partida completada requiere fecha de finalización.'),
    ).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('shows "Ya está en Mis juegos" and still allows another platform', async () => {
    openCatalogPage({
      ...spiderMan,
      gameId: 'g-1',
      libraryEntries: [{ userGameId: 'ug-ps5', platform: ps5 }],
    });

    expect(await screen.findByText('Ya está en Mis juegos')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver mi juego (PS5)' })).toHaveAttribute(
      'href',
      '/games/ug-ps5',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Agregar juego' }));
    const dialog = await screen.findByRole('dialog', { name: 'Agregar juego' });
    const ps5Option = within(dialog).getByRole('option', {
      name: 'PlayStation 5 (ya en Mis juegos)',
    });
    expect(ps5Option).toBeDisabled();
    expect(within(dialog).getByRole('option', { name: 'PlayStation 4' })).toBeEnabled();
  });

  it('cannot be added again once it is on all its platforms', async () => {
    openCatalogPage({
      ...spiderMan,
      gameId: 'g-1',
      libraryEntries: [
        { userGameId: 'ug-ps5', platform: ps5 },
        { userGameId: 'ug-ps4', platform: ps4 },
      ],
    });

    expect(await screen.findByRole('button', { name: 'Agregar juego' })).toBeDisabled();
    expect(screen.getByText('Ya lo agregaste en todas sus plataformas.')).toBeInTheDocument();
  });

  it.each([
    [404, { code: 'CATALOG_GAME_NOT_FOUND' }, 'No encontramos este juego en el catálogo.'],
    [503, { code: 'CATALOG_UNAVAILABLE' }, /El catálogo externo no está disponible/],
  ])('explains a %i error', async (status, body, text) => {
    setup({ 'GET /catalog/games/igdb/1001': () => ({ status, body }) }, '/catalog/igdb/1001');

    expect(await screen.findByText(text, {}, { timeout: 4000 })).toBeInTheDocument();
  });
});
