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
      const { router } = renderRoute('/games?tab=1');

      expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/login');

      await fillCredentials('Player@Example.com ', password);
      await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

      await waitFor(() => expect(router.state.location.pathname).toBe('/games'));
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

  describe('login of an unverified account', () => {
    it('explains it and leads to the verification screen without a session', async () => {
      mockApi({
        'GET /health': healthOk,
        'GET /auth/me': unauthenticated,
        'POST /auth/login': () => ({ status: 403, body: { code: 'EMAIL_NOT_VERIFIED' } }),
      });
      const { router } = renderRoute('/login');

      await screen.findByRole('heading', { name: 'Iniciar sesión' });
      await fillCredentials('new@example.com', password);
      await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

      expect(
        await screen.findByText('Tenés que verificar tu email antes de iniciar sesión.'),
      ).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/login');
      expect(screen.queryByRole('button', { name: 'Menú de usuario' })).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Verificar email' }));
      await waitFor(() => expect(router.state.location.pathname).toBe('/verify-email'));
      expect(router.state.location.search).toBe('?email=new%40example.com');
      expect(await screen.findByText('new@example.com')).toBeInTheDocument();
    });
  });

  describe('register', () => {
    async function fillRegistration(
      values: { username?: string; email?: string; pass?: string; accept?: boolean } = {},
    ) {
      await screen.findByRole('heading', { name: 'Crear cuenta' });
      const { username = 'Player_One', email = 'player@example.com', pass = password } = values;
      await userEvent.type(screen.getByLabelText(/^username/i), username);
      await userEvent.type(screen.getByLabelText(/^email/i), email);
      await userEvent.type(screen.getByLabelText(/^contraseña/i), pass);
      if (values.accept ?? true) {
        await userEvent.click(screen.getByRole('checkbox'));
      }
    }

    it('shows username, email, password and one checkbox with both legal links', async () => {
      mockApi({ 'GET /health': healthOk, 'GET /auth/me': unauthenticated });
      renderRoute('/register');

      await screen.findByRole('heading', { name: 'Crear cuenta' });
      expect(screen.getByLabelText(/^username/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^contraseña/i)).toBeInTheDocument();
      expect(screen.getAllByRole('checkbox')).toHaveLength(1);
      expect(screen.getByRole('link', { name: 'Términos de uso' })).toHaveAttribute(
        'href',
        '/terms',
      );
      expect(screen.getByRole('link', { name: 'Política de privacidad' })).toHaveAttribute(
        'href',
        '/privacy',
      );
    });

    it('requires a valid username and the acceptance before calling the API', async () => {
      const { calls } = mockApi({ 'GET /health': healthOk, 'GET /auth/me': unauthenticated });
      renderRoute('/register');

      await fillRegistration({ username: 'ab', accept: false });
      await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

      expect(screen.getByText('Entre 3 y 30 caracteres.')).toBeInTheDocument();
      expect(
        screen.getByText('Tenés que aceptar los Términos de uso y la Política de privacidad.'),
      ).toBeInTheDocument();
      expect(calls.some((c) => c.path === '/auth/register')).toBe(false);
    });

    it('rejects usernames with invalid characters', async () => {
      const { calls } = mockApi({ 'GET /health': healthOk, 'GET /auth/me': unauthenticated });
      renderRoute('/register');

      await fillRegistration({ username: 'player-one' });
      await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

      expect(screen.getByText('Solo letras, números y guión bajo (_).')).toBeInTheDocument();
      expect(calls.some((c) => c.path === '/auth/register')).toBe(false);
    });

    it('enforces the minimum password length', async () => {
      const { calls } = mockApi({ 'GET /health': healthOk, 'GET /auth/me': unauthenticated });
      renderRoute('/register');

      await fillRegistration({ pass: 'short' });
      await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

      expect(
        screen.getByText('La contraseña debe tener al menos 8 caracteres.'),
      ).toBeInTheDocument();
      expect(calls.some((c) => c.path === '/auth/register')).toBe(false);
    });

    it.each([
      ['EMAIL_ALREADY_REGISTERED', 'Ya existe una cuenta con ese email.'],
      ['USERNAME_TAKEN', 'Ese username ya está en uso.'],
    ])('explains a %s conflict', async (code, text) => {
      mockApi({
        'GET /health': healthOk,
        'GET /auth/me': unauthenticated,
        'POST /auth/register': () => ({ status: 409, body: { code } }),
      });
      renderRoute('/register');

      await fillRegistration();
      await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

      expect(await screen.findByText(text)).toBeInTheDocument();
    });

    it('creates the account without logging in and asks to verify the email', async () => {
      const { calls } = mockApi({
        'GET /health': healthOk,
        'GET /auth/me': unauthenticated,
        'POST /auth/register': () => ({
          status: 201,
          body: { ...testUser, emailVerified: false },
        }),
      });
      const { router } = renderRoute('/register');

      await fillRegistration({ email: 'Player@Example.com ' });
      await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

      await waitFor(() => expect(router.state.location.pathname).toBe('/verify-email'));
      expect(calls.find((c) => c.path === '/auth/register')?.body).toEqual({
        username: 'Player_One',
        email: 'Player@Example.com',
        password,
        acceptTerms: true,
        acceptPrivacy: true,
      });
      expect(await screen.findByRole('heading', { name: 'Verificá tu email' })).toBeInTheDocument();
      expect(screen.getByText('Te enviamos un código de 6 dígitos a:')).toBeInTheDocument();
      expect(screen.getByText(testUser.email)).toBeInTheDocument();
      // The code was just sent: resending starts in cooldown.
      expect(screen.getByRole('button', { name: /Reenviar código \(\d+ s\)/ })).toBeDisabled();
      expect(screen.queryByRole('button', { name: 'Menú de usuario' })).not.toBeInTheDocument();
    });
  });

  describe('email verification', () => {
    const verifyPath = '/verify-email?email=player%40example.com';

    it('verifies the code and returns to the login, without opening a session', async () => {
      let loggedIn = false;
      const { calls } = mockApi({
        'GET /health': healthOk,
        'GET /auth/me': () => (loggedIn ? { status: 200, body: testUser } : unauthenticated()),
        'POST /auth/verify-email': () => ({ status: 204 }),
        'POST /auth/login': () => {
          loggedIn = true;
          return { status: 200, body: testUser };
        },
      });
      const { router } = renderRoute(verifyPath);

      await screen.findByRole('heading', { name: 'Verificá tu email' });
      await userEvent.type(screen.getByLabelText(/código de verificación/i), '123 456');
      await userEvent.click(screen.getByRole('button', { name: 'Verificar email' }));

      await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
      expect(calls.find((c) => c.path === '/auth/verify-email')?.body).toEqual({
        email: 'player@example.com',
        code: '123456',
      });
      expect(
        await screen.findByText('Email verificado. Ya podés iniciar sesión.'),
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toHaveValue('player@example.com');

      await userEvent.type(screen.getByLabelText(/^contraseña/i), password);
      await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
      await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    });

    it('requires the 6 digits before calling the API', async () => {
      const { calls } = mockApi({ 'GET /health': healthOk, 'GET /auth/me': unauthenticated });
      renderRoute(verifyPath);

      await screen.findByRole('heading', { name: 'Verificá tu email' });
      await userEvent.type(screen.getByLabelText(/código de verificación/i), '12a3');
      expect(screen.getByLabelText(/código de verificación/i)).toHaveValue('123');
      await userEvent.click(screen.getByRole('button', { name: 'Verificar email' }));

      expect(screen.getByText('Ingresá los 6 dígitos del código.')).toBeInTheDocument();
      expect(calls.some((c) => c.path === '/auth/verify-email')).toBe(false);
    });

    it('explains a wrong or expired code', async () => {
      mockApi({
        'GET /health': healthOk,
        'GET /auth/me': unauthenticated,
        'POST /auth/verify-email': () => ({
          status: 400,
          body: { code: 'INVALID_VERIFICATION_CODE' },
        }),
      });
      const { router } = renderRoute(verifyPath);

      await screen.findByRole('heading', { name: 'Verificá tu email' });
      await userEvent.type(screen.getByLabelText(/código de verificación/i), '000000');
      await userEvent.click(screen.getByRole('button', { name: 'Verificar email' }));

      expect(
        await screen.findByText('El código es incorrecto o venció. Revisalo o pedí uno nuevo.'),
      ).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/verify-email');
    });

    it('resends the code and then waits for the cooldown', async () => {
      const { calls } = mockApi({
        'GET /health': healthOk,
        'GET /auth/me': unauthenticated,
        'POST /auth/resend-verification': () => ({ status: 202 }),
      });
      renderRoute(verifyPath);

      await userEvent.click(await screen.findByRole('button', { name: 'Reenviar código' }));

      expect(
        await screen.findByText(
          'Si la cuenta existe y no está verificada, te enviamos un código nuevo.',
        ),
      ).toBeInTheDocument();
      expect(calls.find((c) => c.path === '/auth/resend-verification')?.body).toEqual({
        email: 'player@example.com',
      });
      expect(screen.getByRole('button', { name: /Reenviar código \(\d+ s\)/ })).toBeDisabled();
    });

    it('asks for the email when it is not in the URL', async () => {
      const { calls } = mockApi({
        'GET /health': healthOk,
        'GET /auth/me': unauthenticated,
        'POST /auth/verify-email': () => ({ status: 204 }),
      });
      renderRoute('/verify-email');

      await screen.findByRole('heading', { name: 'Verificá tu email' });
      await userEvent.type(screen.getByLabelText(/email de tu cuenta/i), 'a@example.com');
      await userEvent.type(screen.getByLabelText(/código de verificación/i), '654321');
      await userEvent.click(screen.getByRole('button', { name: 'Verificar email' }));

      await waitFor(() =>
        expect(calls.find((c) => c.path === '/auth/verify-email')?.body).toEqual({
          email: 'a@example.com',
          code: '654321',
        }),
      );
    });
  });

  describe('legal documents', () => {
    it.each([
      ['/terms', 'Términos de uso'],
      ['/privacy', 'Política de privacidad'],
    ])('shows %s without a session', async (path, title) => {
      mockApi({ 'GET /health': healthOk, 'GET /auth/me': unauthenticated });
      const { router } = renderRoute(path);

      expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument();
      expect(screen.getByText(/Borrador/)).toBeInTheDocument();
      expect(router.state.location.pathname).toBe(path);
    });
  });

  describe('logout', () => {
    it('logs out from the user menu and returns to /login', async () => {
      const { calls } = mockApi({
        'GET /health': healthOk,
        'GET /auth/me': () => ({ status: 200, body: testUser }),
        'POST /auth/logout': () => ({ status: 204 }),
      });
      const { router } = renderRoute('/games');

      await userEvent.click(await screen.findByRole('button', { name: 'Menú de usuario' }));
      expect(screen.getByText(testUser.email)).toBeInTheDocument();
      await userEvent.click(screen.getByRole('menuitem', { name: 'Cerrar sesión' }));

      await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
      expect(calls.some((c) => c.method === 'POST' && c.path === '/auth/logout')).toBe(true);
      expect(screen.queryByRole('button', { name: 'Menú de usuario' })).not.toBeInTheDocument();
    });
  });

  it('treats EMAIL_NOT_VERIFIED from the API as an ended session', async () => {
    mockApi({ 'GET /health': healthOk, 'GET /auth/me': () => ({ status: 200, body: testUser }) });
    const { router, queryClient } = renderRoute('/games');
    await screen.findByRole('button', { name: 'Menú de usuario' });

    await queryClient
      .fetchQuery({
        queryKey: ['another-feature'],
        queryFn: () => Promise.reject(new ApiError(403, { code: 'EMAIL_NOT_VERIFIED' })),
        retry: false,
      })
      .catch(() => undefined);

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });

  it('treats any 401 from the API as an ended session', async () => {
    mockApi({ 'GET /health': healthOk, 'GET /auth/me': () => ({ status: 200, body: testUser }) });
    const { router, queryClient } = renderRoute('/games');
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
