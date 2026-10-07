import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockApi, testUser } from '../../test/mockApi';
import { renderRoute } from '../../test/renderRoute';
import type { CatalogGame, CatalogSearchResult, LibraryEntry, Platform } from '../library/types';

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
  artworkUrl: '/api/catalog/igdb/images/arspidey?size=artwork',
  platforms: [ps5, ps4],
  genres: [
    { id: 'gen-adv', slug: 'adventure', name: 'Aventura' },
    { id: null, slug: null, name: 'Superhero' },
  ],
  developers: ['Insomniac Games'],
  publishers: ['Sony Interactive Entertainment'],
  screenshots: [],
  relatedGames: [],
  libraryEntries: [],
};

const entry = (userGameId: string, platform: Platform): LibraryEntry => ({
  userGameId,
  platform,
  status: 'IN_PROGRESS',
  totalMinutes: 754,
  rating: 88,
  platinumAchieved: true,
});

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

    expect(
      await screen.findByRole('heading', { level: 1, name: testUser.username }),
    ).toBeInTheDocument();
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
    await userEvent.click(within(dialog).getByRole('radio', { name: 'En progreso' }));
    await userEvent.type(within(dialog).getByLabelText('Fecha de inicio (opcional)'), '2026-01-10');
    await userEvent.click(
      within(within(dialog).getByRole('radiogroup', { name: 'Dificultad' })).getByRole('radio', {
        name: 'Difícil',
      }),
    );
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

  it('shows the name and year in the add dialog, without repeating the cover', async () => {
    openCatalogPage(spiderMan);

    await userEvent.click(await screen.findByRole('button', { name: 'Agregar juego' }));
    const dialog = await screen.findByRole('dialog', { name: 'Agregar juego' });

    // The page behind already shows the cover: the dialog doesn't repeat it.
    expect(within(dialog).queryByRole('img')).not.toBeInTheDocument();
    expect(within(dialog).getByText("Marvel's Spider-Man")).toBeInTheDocument();
    expect(within(dialog).getByText('(2018)', { exact: false })).toBeInTheDocument();
    // Defaults: pending, "Normal" difficulty.
    expect(within(dialog).getByRole('radio', { name: 'Pendiente' })).toBeChecked();
    expect(within(dialog).getByRole('radio', { name: 'Normal' })).toBeChecked();
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
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Completado' }));
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
      libraryEntries: [entry('ug-ps5', ps5)],
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

  it('shows "Tu juego" with the progress of each library entry', async () => {
    openCatalogPage({ ...spiderMan, gameId: 'g-1', libraryEntries: [entry('ug-ps5', ps5)] });

    const panel = await screen.findByRole('region', { name: 'Tu juego' });
    expect(within(panel).getByText('PS5')).toBeInTheDocument();
    expect(within(panel).getByText('En progreso')).toBeInTheDocument();
    expect(within(panel).getByText('12 h 34 min')).toBeInTheDocument();
    expect(within(panel).getByText('88/100')).toBeInTheDocument();
    expect(within(panel).getByRole('img', { name: 'Platino' })).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: 'Ver mi juego (PS5)' })).toHaveAttribute(
      'href',
      '/games/ug-ps5',
    );
  });

  it('has no "Tu juego" panel when the game is not in the library', async () => {
    openCatalogPage(spiderMan);

    await screen.findByRole('heading', { level: 1, name: /Marvel's Spider-Man/ });
    expect(screen.queryByRole('region', { name: 'Tu juego' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Capturas' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Juegos relacionados' })).not.toBeInTheDocument();
  });

  it('shows a screenshot gallery with a full-size viewer', async () => {
    const screenshots = Array.from({ length: 8 }, (_, i) => ({
      thumbnailUrl: `/thumb/${i + 1}`,
      fullUrl: `/full/${i + 1}`,
    }));
    openCatalogPage({ ...spiderMan, screenshots });

    const gallery = await screen.findByRole('region', { name: 'Capturas' });
    const thumbs = within(gallery).getAllByRole('button', { name: /^Ver captura/ });
    expect(thumbs).toHaveLength(6);
    expect(within(gallery).getByText('+2')).toBeInTheDocument();

    await userEvent.click(thumbs[0]);
    const viewer = await screen.findByRole('dialog', { name: 'Captura 1 de 8' });
    expect(within(viewer).getByRole('img')).toHaveAttribute('src', '/full/1');

    await userEvent.click(within(viewer).getByRole('button', { name: 'Siguiente' }));
    expect(within(viewer).getByRole('img')).toHaveAttribute('src', '/full/2');
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    // Wraps around: from the first to the last.
    expect(within(viewer).getByRole('img')).toHaveAttribute('src', '/full/8');
  });

  it('lists related games linking to their catalog pages', async () => {
    openCatalogPage({
      ...spiderMan,
      relatedGames: [
        {
          provider: 'igdb',
          externalId: '1002',
          name: "Marvel's Spider-Man 2",
          releaseDate: '2023-10-20',
          coverUrl: null,
        },
      ],
    });

    const rail = await screen.findByRole('region', { name: 'Juegos relacionados' });
    expect(within(rail).getByRole('link', { name: /Marvel's Spider-Man 2/ })).toHaveAttribute(
      'href',
      '/catalog/igdb/1002',
    );
    expect(within(rail).getByText('2023')).toBeInTheDocument();
  });

  describe('summary of any length', () => {
    const restore: (() => void)[] = [];
    const fakeLayout = (scrollHeight: number, clientHeight: number) => {
      for (const [prop, value] of [
        ['scrollHeight', scrollHeight],
        ['clientHeight', clientHeight],
      ] as const) {
        const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, prop);
        Object.defineProperty(HTMLElement.prototype, prop, {
          configurable: true,
          get: () => value,
        });
        restore.push(() => {
          if (original) Object.defineProperty(HTMLElement.prototype, prop, original);
        });
      }
    };
    afterEach(() => {
      restore.splice(0).forEach((undo) => undo());
    });

    it('keeps a short summary as plain text', async () => {
      fakeLayout(60, 60);
      openCatalogPage({ ...spiderMan, summary: 'Short.' });

      expect(await screen.findByText('Short.')).toBeInTheDocument();
      expect(screen.getByTestId('summary-scroll')).not.toHaveAttribute('tabindex');
    });

    it('gives a very long summary its own keyboard-scrollable area', async () => {
      fakeLayout(4000, 320);
      openCatalogPage({ ...spiderMan, summary: 'Long text. '.repeat(800) });

      const area = await screen.findByTestId('summary-scroll');
      await waitFor(() => expect(area).toHaveAttribute('tabindex', '0'));
      expect(area).toHaveAttribute('role', 'region');
      expect(area).toHaveAccessibleName('Resumen');
    });
  });

  it('cannot be added again once it is on all its platforms', async () => {
    openCatalogPage({
      ...spiderMan,
      gameId: 'g-1',
      libraryEntries: [entry('ug-ps5', ps5), entry('ug-ps4', ps4)],
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
