import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockApi, testUser, unauthenticated } from '../test/mockApi';
import { renderRoute } from '../test/renderRoute';

const catalogGame = {
  gameId: null,
  provider: 'igdb',
  externalId: '1001',
  name: "Marvel's Spider-Man",
  summary: 'Be Spider-Man.',
  releaseDate: '2018-09-07',
  coverUrl: null,
  artworkUrl: null,
  platforms: [{ id: 'ps5', slug: 'ps5', name: 'PlayStation 5', shortName: 'PS5', sortOrder: 1 }],
  genres: [],
  developers: [],
  publishers: [],
  screenshots: [],
  relatedGames: [],
  libraryEntries: [],
  wishlistItemId: null,
};

describe('app routes', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the Home at / for a logged-in user, without any API status indicator', async () => {
    mockApi({ 'GET /auth/me': () => ({ status: 200, body: testUser }) });
    renderRoute('/');

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Tu vida gamer, en un solo lugar',
      }),
    ).toBeVisible();
    expect(await screen.findByRole('button', { name: 'Menú de usuario' })).toBeInTheDocument();
    expect(screen.queryByText(/^API:/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Iniciar sesión' })).not.toBeInTheDocument();
  });

  it('shows the full Home at / to anonymous visitors, with login and sign-up', async () => {
    mockApi({ 'GET /auth/me': unauthenticated });
    const { router } = renderRoute('/');

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Tu vida gamer, en un solo lugar',
      }),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe('/');
    expect(await screen.findByRole('combobox', { name: /buscar/i })).toBeInTheDocument();

    const header = screen.getByRole('banner');
    await userEvent.click(within(header).getByRole('link', { name: 'Crear cuenta' }));
    expect(router.state.location.pathname).toBe('/register');
  });

  it('sends anonymous visitors from the hero to the login', async () => {
    mockApi({ 'GET /auth/me': unauthenticated });
    const { router } = renderRoute('/');

    const hero = (
      await screen.findByRole('heading', { level: 1, name: 'Tu vida gamer, en un solo lugar' })
    ).closest('section') as HTMLElement;
    await userEvent.click(await within(hero).findByRole('link', { name: 'Iniciar sesión' }));
    expect(router.state.location.pathname).toBe('/login');
  });

  it('lets anonymous visitors browse a catalog game; adding it asks to log in first', async () => {
    mockApi({
      'GET /auth/me': unauthenticated,
      'GET /catalog/games/igdb/1001': () => ({ status: 200, body: catalogGame }),
    });
    const { router } = renderRoute('/catalog/igdb/1001');

    expect(
      await screen.findByRole('heading', { level: 1, name: /Marvel's Spider-Man/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('Iniciá sesión para agregarlo a tu biblioteca.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Agregar juego' }));
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.state).toEqual({
      from: { pathname: '/catalog/igdb/1001', search: '' },
    });
  });

  it('still requires a session for the library and the profile', async () => {
    mockApi({ 'GET /auth/me': unauthenticated });
    const { router } = renderRoute('/games');

    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
  });

  it('renders the not found page for unknown routes and links back home', async () => {
    mockApi({ 'GET /auth/me': unauthenticated });
    const { router } = renderRoute('/does-not-exist');

    expect(screen.getByRole('heading', { name: 'Página no encontrada' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('link', { name: 'Volver al inicio' }));
    expect(router.state.location.pathname).not.toBe('/does-not-exist');
  });
});
