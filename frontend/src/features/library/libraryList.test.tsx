import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockApi, testUser } from '../../test/mockApi';
import { renderRoute } from '../../test/renderRoute';
import { filtersFromParams, hasActiveFilters } from './libraryFilters';
import type { Genre, Platform, UserGameListItem } from './types';

const ps5: Platform = { id: 'p-ps5', slug: 'ps5', name: 'PlayStation 5', shortName: 'PS5' };
const rpg: Genre = { id: 'gen-rpg', slug: 'role-playing', name: 'Rol (RPG)' };

const item = (overrides: Partial<UserGameListItem> = {}): UserGameListItem => ({
  id: 'ug-1',
  game: { id: 'g-1', name: 'Bloodborne', coverUrl: null, isManual: false },
  platform: ps5,
  status: 'COMPLETED',
  startDate: '2025-01-01',
  completionDate: '2025-03-01',
  totalMinutes: 900,
  rating: null,
  platinumAchieved: true,
  favorite: false,
  createdAt: '2025-01-01T00:00:00.000Z',
  difficulty: null,
  steam: false,
  achievements: null,
  ...overrides,
});

function setup(handlers: Parameters<typeof mockApi>[0] = {}, path = '/games') {
  const api = mockApi({
    'GET /auth/me': () => ({ status: 200, body: testUser }),
    'GET /platforms': () => ({ status: 200, body: [ps5] }),
    'GET /genres': () => ({ status: 200, body: [rpg] }),
    'GET /library': () => ({ status: 200, body: [item()] }),
    ...handlers,
  });
  return { ...api, ...renderRoute(path) };
}

const libraryCalls = (calls: { method: string; path: string }[]) =>
  calls.filter((c) => c.method === 'GET' && c.path.startsWith('/library')).map((c) => c.path);

describe('library list', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the platinum badge and "Sin valorar" on the card', async () => {
    setup();

    const card = await screen.findByRole('article', { name: 'Bloodborne' });
    expect(within(card).getByRole('img', { name: 'Platino' })).toBeInTheDocument();
    expect(within(card).getByText('Sin valorar')).toBeInTheDocument();
    expect(screen.getByText('1 juego')).toBeInTheDocument();
  });

  it('shows the hardest difficulty played on the card, with its level', async () => {
    setup({
      'GET /library': () => ({
        status: 200,
        body: [
          item({ difficulty: { name: 'Difícil', level: 2, levels: 3 } }),
          item({ id: 'ug-2', game: { id: 'g-2', name: 'Hades', coverUrl: null, isManual: false } }),
        ],
      }),
    });

    const card = await screen.findByRole('article', { name: 'Bloodborne' });
    expect(
      within(card).getByRole('img', { name: 'Dificultad: Difícil (3 de 3)' }),
    ).toBeInTheDocument();
    // No difficulty played: nothing is shown.
    const hades = screen.getByRole('article', { name: 'Hades' });
    expect(within(hades).queryByRole('img', { name: /Dificultad/ })).not.toBeInTheDocument();
  });

  it('shows the achievements progress and Steam games outside the catalog', async () => {
    setup({
      'GET /library': () => ({
        status: 200,
        body: [
          item({ steam: true, achievements: { achieved: 12, total: 33 } }),
          item({
            id: 'ug-2',
            steam: true,
            game: { id: 'g-2', name: 'Tiny Indie', coverUrl: null, isManual: true },
          }),
        ],
      }),
    });

    const card = await screen.findByRole('article', { name: 'Bloodborne' });
    expect(within(card).getByRole('img', { name: '12 de 33 logros' })).toBeInTheDocument();
    expect(within(card).queryByText('Manual: no está en el catálogo')).not.toBeInTheDocument();
    const indie = screen.getByRole('article', { name: 'Tiny Indie' });
    expect(within(indie).getByText('Manual: no está en el catálogo')).toBeInTheDocument();
    expect(within(indie).queryByRole('img', { name: /logros/ })).not.toBeInTheDocument();
  });

  it('marks and unmarks a favorite from the card', async () => {
    let favorite = false;
    const { calls } = setup({
      'GET /library': () => ({ status: 200, body: [item({ favorite })] }),
      'PATCH /library/ug-1': (request) => {
        favorite = (request.body as { favorite: boolean }).favorite;
        return { status: 200, body: { ...item({ favorite }) } };
      },
    });

    const card = await screen.findByRole('article', { name: 'Bloodborne' });
    const heart = within(card).getByRole('button', { name: 'Marcar Bloodborne como favorito' });
    expect(heart).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(heart);

    const marked = await within(card).findByRole('button', {
      name: 'Quitar Bloodborne de favoritos',
    });
    expect(marked).toHaveAttribute('aria-pressed', 'true');
    expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ favorite: true });
  });

  it('explains the limit when there are already 5 favorites', async () => {
    setup({
      'PATCH /library/ug-1': () => ({
        status: 409,
        body: { statusCode: 409, code: 'FAVORITES_LIMIT_REACHED', message: 'limit' },
      }),
    });

    const card = await screen.findByRole('article', { name: 'Bloodborne' });
    await userEvent.click(
      within(card).getByRole('button', { name: 'Marcar Bloodborne como favorito' }),
    );
    expect(
      await screen.findByText('Ya tenés 5 favoritos. Quitá uno para sumar otro.'),
    ).toBeInTheDocument();
  });

  it('sends filters to the API and keeps them in the URL', async () => {
    const { calls, router } = setup({
      'GET /library?status=COMPLETED': () => ({ status: 200, body: [item()] }),
      'GET /library?status=COMPLETED&platformId=p-ps5': () => ({ status: 200, body: [item()] }),
      'GET /library?status=COMPLETED&platformId=p-ps5&platinum=true': () => ({
        status: 200,
        body: [item()],
      }),
      'GET /library?status=COMPLETED&platformId=p-ps5&genreId=gen-rpg&platinum=true': () => ({
        status: 200,
        body: [item()],
      }),
    });
    await screen.findByRole('article', { name: 'Bloodborne' });

    await userEvent.click(
      within(screen.getByRole('radiogroup', { name: 'Estado' })).getByRole('radio', {
        name: 'Completado',
      }),
    );
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Plataforma' }),
      'PlayStation 5',
    );
    await userEvent.click(screen.getByRole('radio', { name: 'Con platino' }));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Género' }), 'Rol (RPG)');

    await waitFor(() =>
      expect(libraryCalls(calls)).toContain(
        '/library?status=COMPLETED&platformId=p-ps5&genreId=gen-rpg&platinum=true',
      ),
    );
    expect(router.state.location.search).toBe(
      '?status=COMPLETED&platformId=p-ps5&genreId=gen-rpg&platinum=true',
    );
  });

  it('searches by name with a debounce', async () => {
    const { calls } = setup({
      'GET /library?search=blood': () => ({ status: 200, body: [item()] }),
    });
    await screen.findByRole('article', { name: 'Bloodborne' });

    await userEvent.type(screen.getByLabelText('Buscar en mis juegos'), 'blood');

    await waitFor(() => expect(libraryCalls(calls)).toContain('/library?search=blood'));
    // Not one request per keystroke.
    expect(libraryCalls(calls).filter((p) => p.includes('search='))).toEqual([
      '/library?search=blood',
    ]);
  });

  it('sorts with the natural default direction and can reverse it', async () => {
    const { calls } = setup({
      'GET /library?sort=rating&order=desc': () => ({ status: 200, body: [item()] }),
      'GET /library?sort=rating&order=asc': () => ({ status: 200, body: [item()] }),
    });
    await screen.findByRole('article', { name: 'Bloodborne' });

    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Ordenar por' }),
      'Valoración',
    );
    await waitFor(() => expect(libraryCalls(calls)).toContain('/library?sort=rating&order=desc'));

    await userEvent.click(screen.getByRole('button', { name: /Cambiar orden/ }));
    await waitFor(() => expect(libraryCalls(calls)).toContain('/library?sort=rating&order=asc'));
  });

  it('distinguishes "no results" (with a way to clear filters) from an empty library', async () => {
    setup(
      { 'GET /library?status=PENDING': () => ({ status: 200, body: [] }) },
      '/games?status=PENDING',
    );

    expect(await screen.findByText('No hay juegos que coincidan')).toBeInTheDocument();
    expect(screen.queryByText('Tu biblioteca está vacía')).not.toBeInTheDocument();

    await userEvent.click(screen.getAllByRole('button', { name: 'Limpiar filtros' })[0]);
    expect(await screen.findByRole('article', { name: 'Bloodborne' })).toBeInTheDocument();
  });

  it('shows the active filters from the URL in the side column', async () => {
    setup(
      {
        'GET /library?status=IN_PROGRESS&platinum=false': () => ({
          status: 200,
          body: [item()],
        }),
      },
      '/games?status=IN_PROGRESS&platinum=false',
    );

    const filters = await screen.findByRole('complementary', { name: 'Filtros' });
    expect(within(filters).getByRole('radio', { name: 'En progreso' })).toBeChecked();
    expect(within(filters).getByRole('radio', { name: 'Sin platino' })).toBeChecked();
    for (const radio of within(filters).getAllByRole('radio', { name: 'Todos' })) {
      expect(radio).not.toBeChecked();
    }
    expect(within(filters).getByRole('button', { name: 'Limpiar filtros' })).toBeInTheDocument();
  });

  it('ignores invalid filter values in the URL', () => {
    const filters = filtersFromParams(
      new URLSearchParams('status=PLATINUM&sort=random&platinum=yes'),
    );
    expect(filters).toEqual({
      search: undefined,
      status: undefined,
      platformId: undefined,
      genreId: undefined,
      platinum: undefined,
      sort: undefined,
      order: undefined,
    });
    expect(hasActiveFilters(filters)).toBe(false);
  });
});
