import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyHighlights, emptyStats, mockApi, testUser } from '../../test/mockApi';
import { renderRoute } from '../../test/renderRoute';
import type { ActivityItem, Friends, PlayerProfile } from './api';

const me = () => ({ status: 200, body: testUser });
const friendsOf = (overrides: Partial<Friends> = {}): Friends => ({
  friends: [],
  incoming: [],
  outgoing: [],
  ...overrides,
});
const someone = (username: string, since = '2026-10-01T10:00:00.000Z') => ({
  username,
  avatar: null,
  since,
});

describe('social', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('friends page', () => {
    it('finds players and sends requests', async () => {
      const { calls } = mockApi({
        'GET /auth/me': me,
        'GET /blocks': () => ({ status: 200, body: [] }),
        'GET /users/search?q=gab': () => ({
          status: 200,
          body: [{ username: 'gabe', avatar: null, relation: 'NONE' }],
        }),
        'POST /friends/requests': () => ({ status: 200, body: { relation: 'REQUEST_SENT' } }),
      });
      renderRoute('/friends');

      await userEvent.type(
        await screen.findByRole('textbox', { name: 'Buscar jugadores por username' }),
        'gab',
      );
      const results = await screen.findByRole('list', { name: 'Buscar jugadores por username' });
      expect(within(results).getByText('gabe')).toBeInTheDocument();
      await userEvent.click(within(results).getByRole('button', { name: 'Agregar' }));
      await waitFor(() =>
        expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ username: 'gabe' }),
      );
    });

    it('accepts requests and lists friends with their profiles', async () => {
      const { calls } = mockApi({
        'GET /auth/me': me,
        'GET /blocks': () => ({ status: 200, body: [] }),
        'GET /friends': () => ({
          status: 200,
          body: friendsOf({ incoming: [someone('carol')], friends: [someone('bobby')] }),
        }),
        'POST /friends/requests/carol/accept': () => ({ status: 204 }),
      });
      renderRoute('/friends');

      const incoming = await screen.findByRole('region', { name: 'Solicitudes recibidas' });
      await userEvent.click(within(incoming).getByRole('button', { name: 'Aceptar' }));
      await waitFor(() =>
        expect(calls.some((c) => c.path === '/friends/requests/carol/accept')).toBe(true),
      );
      const list = screen.getByRole('region', { name: 'Tus amigos (1)' });
      expect(within(list).getByRole('link', { name: 'bobby' })).toHaveAttribute('href', '/u/bobby');
      expect(within(list).getByText('Amigos desde el 01/10/2026')).toBeInTheDocument();
    });

    it('shows pending requests in the header', async () => {
      mockApi({
        'GET /auth/me': me,
        'GET /friends': () => ({
          status: 200,
          body: friendsOf({ incoming: [someone('carol'), someone('dave')] }),
        }),
      });
      renderRoute('/');
      const nav = await screen.findByRole('navigation', { name: 'Navegación principal' });
      expect(await within(nav).findByLabelText('2 solicitudes de amistad')).toBeInTheDocument();
    });
  });

  describe('activity', () => {
    const item = (overrides: Partial<ActivityItem>): ActivityItem => ({
      id: 'a-1',
      type: 'STATUS_CHANGED',
      createdAt: new Date().toISOString(),
      user: { username: 'bobby', avatar: null },
      self: false,
      game: {
        name: 'Hades',
        coverUrl: null,
        userGameId: 'ug-9',
        provider: null,
        externalId: null,
      },
      data: { status: 'COMPLETED' },
      ...overrides,
    });

    it("shows what the user and their friends did, with links to the friend's game", async () => {
      mockApi({
        'GET /auth/me': me,
        'GET /activity': () => ({
          status: 200,
          body: {
            items: [
              item({}),
              item({
                id: 'a-2',
                type: 'ACHIEVEMENTS',
                self: true,
                user: { username: testUser.username, avatar: null },
                data: { count: 3 },
              }),
              item({ id: 'a-3', type: 'STEAM_IMPORT', game: null, data: { count: 40 } }),
            ],
            next: 'cursor-1',
          },
        }),
        'GET /activity?cursor=cursor-1': () => ({
          status: 200,
          body: { items: [item({ id: 'a-4', type: 'RATED', data: { rating: 90 } })], next: null },
        }),
      });
      renderRoute('/activity');

      const list = await screen.findByRole('list', { name: 'Actividad' });
      const rows = within(list).getAllByRole('listitem');
      expect(rows[0]).toHaveTextContent('bobby completó Hades');
      expect(within(rows[0]).getByRole('link', { name: 'Hades' })).toHaveAttribute(
        'href',
        '/u/bobby/games/ug-9',
      );
      expect(rows[1]).toHaveTextContent(`${testUser.username}Vos desbloqueó 3 logros en Hades`);
      expect(within(rows[1]).getByRole('link', { name: 'Hades' })).toHaveAttribute(
        'href',
        '/games/ug-9',
      );
      expect(rows[2]).toHaveTextContent('bobby agregó 40 juegos desde Steam');

      await userEvent.click(screen.getByRole('button', { name: 'Cargar más' }));
      expect(await screen.findByText(/valoró/)).toHaveTextContent('valoró Hades con 90/100');
    });
  });

  describe("a player's profile", () => {
    const profile: PlayerProfile = {
      user: { username: 'bobby', avatar: null, memberSince: '2026-01-02T10:00:00.000Z' },
      self: false,
      relation: 'FRIEND',
      stats: { ...emptyStats, totalGames: 7 },
      highlights: emptyHighlights,
    };

    it('shows their card, stats and tabs, read-only', async () => {
      mockApi({
        'GET /auth/me': me,
        'GET /users/bobby/profile': () => ({ status: 200, body: profile }),
        'GET /users/bobby/activity': () => ({ status: 200, body: { items: [], next: null } }),
        'GET /users/bobby/library?sort=createdAt&order=desc': () => ({ status: 200, body: [] }),
      });
      renderRoute('/u/bobby');

      expect(await screen.findByRole('heading', { level: 1, name: 'bobby' })).toBeInTheDocument();
      expect(screen.getByText('Miembro desde el 02/01/2026')).toBeInTheDocument();
      expect(await screen.findByText('Todavía no tiene actividad.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Opciones de bobby' })).toBeInTheDocument();
      await userEvent.click(screen.getByRole('radio', { name: 'Biblioteca' }));
      expect(await screen.findByText('Todavía no tiene juegos.')).toBeInTheDocument();
    });

    it('explains a private profile', async () => {
      mockApi({
        'GET /auth/me': me,
        'GET /users/bobby/profile': () => ({
          status: 403,
          body: { code: 'PROFILE_PRIVATE' },
        }),
      });
      renderRoute('/u/bobby');
      expect(
        await screen.findByText('Este jugador eligió que nadie vea su perfil.'),
      ).toBeInTheDocument();
    });

    it('reports a player', async () => {
      const { calls } = mockApi({
        'GET /auth/me': me,
        'GET /users/bobby/profile': () => ({ status: 200, body: profile }),
        'GET /users/bobby/activity': () => ({ status: 200, body: { items: [], next: null } }),
        'POST /reports': () => ({ status: 204 }),
      });
      renderRoute('/u/bobby');
      await userEvent.click(await screen.findByRole('button', { name: 'Opciones de bobby' }));
      await userEvent.click(screen.getByRole('menuitem', { name: 'Denunciar' }));
      const dialog = await screen.findByRole('dialog', { name: 'Denunciar a bobby' });
      await userEvent.click(within(dialog).getByRole('radio', { name: 'Username ofensivo' }));
      await userEvent.click(within(dialog).getByRole('button', { name: 'Enviar denuncia' }));
      expect(await within(dialog).findByText(/Recibimos tu denuncia/)).toBeInTheDocument();
      expect(calls.find((c) => c.path === '/reports')?.body).toEqual({
        username: 'bobby',
        reason: 'USERNAME',
        details: null,
      });
    });
  });

  it('lets the user choose who sees their profile', async () => {
    const { calls } = mockApi({
      'GET /auth/me': me,
      'PUT /profile/visibility': () => ({ status: 204 }),
    });
    renderRoute('/profile');
    await userEvent.click(await screen.findByRole('combobox', { name: 'Visible para' }));
    await userEvent.click(screen.getByRole('option', { name: 'Solo yo' }));
    await waitFor(() =>
      expect(calls.find((c) => c.path === '/profile/visibility')?.body).toEqual({
        visibility: 'PRIVATE',
      }),
    );
  });

  it('asks to accept updated legal documents before going on', async () => {
    const { calls } = mockApi({
      'GET /auth/me': () => ({
        status: 200,
        body: { ...testUser, legalAcceptanceRequired: true },
      }),
      'POST /auth/accept-legal': () => ({ status: 200, body: testUser }),
    });
    renderRoute('/');
    const dialog = await screen.findByRole('dialog', {
      name: 'Actualizamos los Términos y la Política de privacidad',
    });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Aceptar y continuar' }));
    expect(within(dialog).getByText(/Tenés que aceptarlos/)).toBeInTheDocument();
    expect(calls.some((c) => c.path === '/auth/accept-legal')).toBe(false);

    await userEvent.click(within(dialog).getByRole('checkbox'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Aceptar y continuar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(calls.find((c) => c.path === '/auth/accept-legal')?.body).toEqual({
      acceptTerms: true,
      acceptPrivacy: true,
    });
  });
});
