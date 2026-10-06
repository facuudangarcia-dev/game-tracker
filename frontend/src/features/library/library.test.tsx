import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockApi, testUser } from '../../test/mockApi';
import { renderRoute } from '../../test/renderRoute';
import type { CatalogSearchResult, Platform, UserGameListItem } from './types';

const ps4: Platform = { id: 'p-ps4', slug: 'ps4', name: 'PlayStation 4', shortName: 'PS4' };
const pc: Platform = { id: 'p-pc', slug: 'pc', name: 'PC', shortName: 'PC' };
const gb: Platform = { id: 'p-gb', slug: 'gb', name: 'Game Boy', shortName: 'Game Boy' };

const witcher: CatalogSearchResult = {
  gameId: null,
  provider: 'igdb',
  externalId: '1942',
  name: 'The Witcher 3: Wild Hunt',
  releaseDate: '2015-05-19',
  coverUrl: '/api/catalog/igdb/images/co1wyy',
  platforms: [ps4, pc],
  isManual: false,
};

const libraryItem: UserGameListItem = {
  id: 'ug-1',
  game: { id: 'g-1', name: 'Hollow Knight', coverUrl: null, isManual: false },
  platform: pc,
  status: 'IN_PROGRESS',
  startDate: '2026-01-01',
  completionDate: null,
  totalMinutes: 872,
  rating: 95,
  platinumAchieved: false,
  createdAt: '2026-01-01T10:00:00.000Z',
};

const me = () => ({ status: 200, body: testUser });
const created = (name = 'X') => ({
  status: 201,
  body: { ...libraryItem, game: { ...libraryItem.game, name }, playthroughs: [] },
});

async function openDialog() {
  const { router } = renderRoute('/games');
  await userEvent.click(await screen.findByRole('button', { name: 'Agregar juego' }));
  return { dialog: await screen.findByRole('dialog'), router };
}

describe('library', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows an empty state with a call to action', async () => {
    mockApi({ 'GET /auth/me': me });
    renderRoute('/games');

    expect(await screen.findByText('Tu biblioteca está vacía')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Agregar juego' })).toHaveLength(2);
  });

  it('lists games with name, platform, status and time', async () => {
    mockApi({ 'GET /auth/me': me, 'GET /library': () => ({ status: 200, body: [libraryItem] }) });
    renderRoute('/games');

    expect(await screen.findByRole('heading', { name: 'Hollow Knight' })).toBeInTheDocument();
    expect(screen.getByText('PC')).toBeInTheDocument();
    expect(screen.getByText('En progreso')).toBeInTheDocument();
    expect(screen.getByText('14 h 32 min')).toBeInTheDocument();
  });

  it('shows an error with a retry action', async () => {
    mockApi({ 'GET /auth/me': me, 'GET /library': () => ({ status: 500, body: {} }) });
    renderRoute('/games');

    // Server errors are retried once before showing the error.
    expect(
      await screen.findByText('No se pudo cargar tu biblioteca.', {}, { timeout: 4000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  describe('adding a game', () => {
    it('adds a catalog game offering only the platforms the catalog reports', async () => {
      const { calls } = mockApi({
        'GET /auth/me': me,
        'GET /platforms': () => ({ status: 200, body: [ps4, pc, gb] }),
        'GET /catalog/search?q=witcher': () => ({
          status: 200,
          body: { results: [witcher], catalogAvailable: true },
        }),
        'POST /library': () => created('The Witcher 3: Wild Hunt'),
      });
      const { dialog, router } = await openDialog();

      await userEvent.type(within(dialog).getByLabelText('Buscar juego'), 'witcher');
      await userEvent.click(await within(dialog).findByText('The Witcher 3: Wild Hunt'));

      const platformSelect = within(dialog).getByLabelText(/Plataforma/);
      const options = within(platformSelect)
        .getAllByRole('option')
        .map((o) => o.textContent);
      expect(options).toEqual(['Elegí una plataforma', 'PlayStation 4', 'PC']);

      await userEvent.selectOptions(platformSelect, 'PlayStation 4');
      await userEvent.click(
        within(dialog).getByRole('button', { name: 'Agregar a mi biblioteca' }),
      );

      // The new game opens in its detail page.
      await waitFor(() => expect(router.state.location.pathname).toBe('/games/ug-1'));
      expect(calls.find((c) => c.method === 'POST')?.body).toEqual({
        platformId: ps4.id,
        catalog: { provider: 'igdb', externalId: '1942' },
      });
    });

    it('reuses an already imported game by its id', async () => {
      const { calls } = mockApi({
        'GET /auth/me': me,
        'GET /platforms': () => ({ status: 200, body: [ps4, pc, gb] }),
        'GET /catalog/search?q=witcher': () => ({
          status: 200,
          body: { results: [{ ...witcher, gameId: 'g-9' }], catalogAvailable: true },
        }),
        'POST /library': () => created(),
      });
      const { dialog } = await openDialog();

      await userEvent.type(within(dialog).getByLabelText('Buscar juego'), 'witcher');
      await userEvent.click(await within(dialog).findByText('The Witcher 3: Wild Hunt'));
      await userEvent.selectOptions(within(dialog).getByLabelText(/Plataforma/), 'PC');
      await userEvent.click(
        within(dialog).getByRole('button', { name: 'Agregar a mi biblioteca' }),
      );

      await waitFor(() =>
        expect(calls.find((c) => c.method === 'POST')?.body).toEqual({
          platformId: pc.id,
          gameId: 'g-9',
        }),
      );
    });

    it('creates a manual game on any platform', async () => {
      const { calls } = mockApi({
        'GET /auth/me': me,
        'GET /platforms': () => ({ status: 200, body: [ps4, pc, gb] }),
        'POST /library': () => created('Mi homebrew'),
      });
      const { dialog } = await openDialog();

      await userEvent.click(within(dialog).getByRole('button', { name: 'Juego manual' }));
      await userEvent.type(within(dialog).getByLabelText(/Nombre del juego/), '  Mi homebrew ');
      expect(within(dialog).getByText(/solo vos podrás verlo/)).toBeInTheDocument();
      await userEvent.selectOptions(within(dialog).getByLabelText(/Plataforma/), 'Game Boy');
      await userEvent.click(
        within(dialog).getByRole('button', { name: 'Agregar a mi biblioteca' }),
      );

      await waitFor(() =>
        expect(calls.find((c) => c.method === 'POST')?.body).toEqual({
          platformId: gb.id,
          manualGame: { name: 'Mi homebrew' },
        }),
      );
    });

    it('explains when the game is already in the library on that platform', async () => {
      mockApi({
        'GET /auth/me': me,
        'GET /platforms': () => ({ status: 200, body: [ps4, pc, gb] }),
        'POST /library': () => ({ status: 409, body: { code: 'USER_GAME_ALREADY_EXISTS' } }),
      });
      const { dialog } = await openDialog();

      await userEvent.click(within(dialog).getByRole('button', { name: 'Juego manual' }));
      await userEvent.type(within(dialog).getByLabelText(/Nombre del juego/), 'Dup');
      await userEvent.selectOptions(within(dialog).getByLabelText(/Plataforma/), 'PC');
      await userEvent.click(
        within(dialog).getByRole('button', { name: 'Agregar a mi biblioteca' }),
      );

      expect(
        await within(dialog).findByText('Ya tenés este juego registrado en esa plataforma.'),
      ).toBeInTheDocument();
    });

    it('warns when the external catalog is unavailable', async () => {
      mockApi({
        'GET /auth/me': me,
        'GET /platforms': () => ({ status: 200, body: [] }),
        'GET /catalog/search?q=zelda': () => ({
          status: 200,
          body: { results: [], catalogAvailable: false },
        }),
      });
      const { dialog } = await openDialog();

      await userEvent.type(within(dialog).getByLabelText('Buscar juego'), 'zelda');

      expect(
        await within(dialog).findByText(/El catálogo externo no está disponible/),
      ).toBeInTheDocument();
      expect(
        within(dialog).getByRole('button', { name: 'Agregar a mi biblioteca' }),
      ).toBeDisabled();
    });
  });
});
