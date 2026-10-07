import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { healthOk, mockApi, testUser, unauthenticated } from '../test/mockApi';
import { renderRoute } from '../test/renderRoute';

describe('app routes', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the Home at / for a logged-in user', async () => {
    mockApi({
      'GET /health': healthOk,
      'GET /auth/me': () => ({ status: 200, body: testUser }),
    });
    renderRoute('/');

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Tu historial personal de videojuegos',
      }),
    ).toBeVisible();
    expect(await screen.findByText('API: conectada')).toBeInTheDocument();
  });

  it('shows the API as disconnected when the health check fails', async () => {
    mockApi({
      'GET /health': () => ({ status: 503, body: {} }),
      'GET /auth/me': unauthenticated,
    });
    renderRoute('/login');

    expect(await screen.findByText('API: sin conexión')).toBeInTheDocument();
  });

  it('renders the not found page for unknown routes and links back home', async () => {
    mockApi({ 'GET /health': healthOk, 'GET /auth/me': unauthenticated });
    const { router } = renderRoute('/does-not-exist');

    expect(screen.getByRole('heading', { name: 'Página no encontrada' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('link', { name: 'Volver al inicio' }));
    expect(router.state.location.pathname).not.toBe('/does-not-exist');
  });
});
