import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../lib/api/client';
import { healthOk, mockApi, testUser, unauthenticated } from '../../test/mockApi';
import { renderRoute } from '../../test/renderRoute';

const password = 'super-secret-1';

async function fillCredentials(email: string, pass: string) {
  await userEvent.type(screen.getByLabelText(/email/i), email);
  await userEvent.type(screen.getByLabelText(/^contraseña/i), pass);
}

describe('authentication flow', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('route guards', () => {
    it('sends logged-out users to /login and back to the original page after login', async () => {
      let loggedIn = false;
      const { calls } = mockApi({
        'GET /health': healthOk,
        'GET /auth/me': () => (loggedIn ? { status: 200, body: testUser } : unauthenticated()),
        'POST /auth/login': () => {
          loggedIn = true;
          return { status: 200, body: testUser };
        },
      });
      const { router } = renderRoute('/?tab=1');

      expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/login');

      await fillCredentials('Player@Example.com ', password);
      await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

      await waitFor(() => expect(router.state.location.pathname).toBe('/'));
      expect(router.state.location.search).toBe('?tab=1');
      expect(calls.find((c) => c.path === '/auth/login')?.body).toEqual({
        email: 'Player@Example.com',
        password,
      });
    });

    it('redirects logged-in users away from /login', async () => {
      mockApi({ 'GET /health': healthOk, 'GET /auth/me': () => ({ status: 200, body: testUser }) });
      const { router } = renderRoute('/login');

      await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    });
  });

  describe('login', () => {
    it('validates fields before calling the API', async () => {
      const { calls } = mockApi({ 'GET /health': healthOk, 'GET /auth/me': unauthenticated });
      renderRoute('/login');

      await userEvent.click(await screen.findByRole('button', { name: 'Ingresar' }));

      expect(screen.getByText('Ingresá tu email.')).toBeInTheDocument();
      expect(screen.getByText('Ingresá tu contraseña.')).toBeInTheDocument();
      expect(calls.some((c) => c.path === '/auth/login')).toBe(false);
    });

    it('shows a generic message for invalid credentials', async () => {
      mockApi({
        'GET /health': healthOk,
        'GET /auth/me': unauthenticated,
        'POST /auth/login': () => ({ status: 401, body: { code: 'INVALID_CREDENTIALS' } }),
      });
      const { router } = renderRoute('/login');

      await screen.findByRole('heading', { name: 'Iniciar sesión' });
      await fillCredentials('player@example.com', 'wrong-password');
      await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

      expect(await screen.findByText('Email o contraseña incorrectos.')).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/login');
    });

    it('can reveal the password', async () => {
      mockApi({ 'GET /health': healthOk, 'GET /auth/me': unauthenticated });
      renderRoute('/login');

      const input = await screen.findByLabelText(/^contraseña/i);
      expect(input).toHaveAttribute('type', 'password');

      await userEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
      expect(input).toHaveAttribute('type', 'text');
    });
  });

  describe('register', () => {
    it('enforces the minimum password length', async () => {
      const { calls } = mockApi({ 'GET /health': healthOk, 'GET /auth/me': unauthenticated });
      renderRoute('/register');

      await screen.findByRole('heading', { name: 'Crear cuenta' });
      await fillCredentials('new@example.com', 'short');
      await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

      expect(
        screen.getByText('La contraseña debe tener al menos 8 caracteres.'),
      ).toBeInTheDocument();
      expect(calls.some((c) => c.path === '/auth/register')).toBe(false);
    });

    it('explains when the email is already registered', async () => {
      mockApi({
        'GET /health': healthOk,
        'GET /auth/me': unauthenticated,
        'POST /auth/register': () => ({ status: 409, body: { code: 'EMAIL_ALREADY_REGISTERED' } }),
      });
      renderRoute('/register');

      await screen.findByRole('heading', { name: 'Crear cuenta' });
      await fillCredentials('taken@example.com', password);
      await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

      expect(await screen.findByText('Ya existe una cuenta con ese email.')).toBeInTheDocument();
    });

    it('logs the new user in and goes home', async () => {
      mockApi({
        'GET /health': healthOk,
        'GET /auth/me': unauthenticated,
        'POST /auth/register': () => ({ status: 201, body: testUser }),
      });
      const { router } = renderRoute('/register');

      await screen.findByRole('heading', { name: 'Crear cuenta' });
      await fillCredentials('player@example.com', password);
      await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

      await waitFor(() => expect(router.state.location.pathname).toBe('/'));
      expect(await screen.findByRole('button', { name: 'Menú de usuario' })).toBeInTheDocument();
    });
  });

  describe('logout', () => {
    it('logs out from the user menu and returns to /login', async () => {
      const { calls } = mockApi({
        'GET /health': healthOk,
        'GET /auth/me': () => ({ status: 200, body: testUser }),
        'POST /auth/logout': () => ({ status: 204 }),
      });
      const { router } = renderRoute('/');

      await userEvent.click(await screen.findByRole('button', { name: 'Menú de usuario' }));
      expect(screen.getByText(testUser.email)).toBeInTheDocument();
      await userEvent.click(screen.getByRole('menuitem', { name: 'Cerrar sesión' }));

      await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
      expect(calls.some((c) => c.method === 'POST' && c.path === '/auth/logout')).toBe(true);
      expect(screen.queryByRole('button', { name: 'Menú de usuario' })).not.toBeInTheDocument();
    });
  });

  it('treats any 401 from the API as an ended session', async () => {
    mockApi({ 'GET /health': healthOk, 'GET /auth/me': () => ({ status: 200, body: testUser }) });
    const { router, queryClient } = renderRoute('/');
    await screen.findByRole('button', { name: 'Menú de usuario' });

    // Simulates a feature query failing because the session expired server-side.
    await queryClient
      .fetchQuery({
        queryKey: ['another-feature'],
        queryFn: () => Promise.reject(new ApiError(401, { code: 'UNAUTHENTICATED' })),
        retry: false,
      })
      .catch(() => undefined);

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });
});
