import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyStats, mockApi, testUser } from '../../test/mockApi';
import { renderRoute } from '../../test/renderRoute';
import type { PlayerHighlights, PlayerStats } from './api';

const stats: PlayerStats = {
  totalGames: 12,
  completed: 6,
  inProgress: 3,
  played: 1,
  pending: 2,
  platinums: 2,
  totalMinutes: 7623,
  rated: 8,
  averageRating: 86.5,
  playthroughs: 15,
  topPlatform: { name: 'PlayStation 5', shortName: 'PS5', games: 7 },
};

function setup(handlers: Parameters<typeof mockApi>[0] = {}) {
  const api = mockApi({
    'GET /auth/me': () => ({ status: 200, body: testUser }),
    'GET /profile/stats': () => ({ status: 200, body: stats }),
    ...handlers,
  });
  return { ...api, ...renderRoute('/profile') };
}

describe('profile', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the player card: avatar, username and member since', async () => {
    setup();

    expect(
      await screen.findByRole('heading', { level: 1, name: testUser.username }),
    ).toBeInTheDocument();
    // Without avatar: the username's initial.
    expect(
      screen.getByRole('img', { name: `Foto de perfil de ${testUser.username}` }),
    ).toHaveTextContent('p');
    expect(screen.getByText(/Miembro desde/)).toHaveTextContent('Miembro desde 04/10/2026');
    expect(screen.getByText(testUser.email)).toBeInTheDocument();
  });

  it('shows the real statistics of the player', async () => {
    setup();

    const section = await screen.findByRole('region', { name: 'Estadísticas del jugador' });
    await within(section).findByText('Juegos registrados');
    const tile = (label: string) => within(section).getByText(label).closest('li')!;

    expect(tile('Horas jugadas')).toHaveTextContent('127h');
    expect(tile('Horas jugadas')).toHaveTextContent('15 · Partidas');
    expect(tile('Juegos registrados')).toHaveTextContent('12');
    expect(tile('Platinos obtenidos')).toHaveTextContent('2');
    expect(tile('Valoración media')).toHaveTextContent('86.5');
    expect(tile('Valoración media')).toHaveTextContent('8 juegos valorados');
    expect(tile('Plataforma principal')).toHaveTextContent('PS5');
    expect(tile('Plataforma principal')).toHaveTextContent('7 juegos');
    const breakdown = tile('Estado de tu biblioteca');
    expect(breakdown).toHaveTextContent('50% completado');
    expect(breakdown).toHaveTextContent('Completados6');
    expect(breakdown).toHaveTextContent('En progreso3');
    expect(breakdown).toHaveTextContent('Jugados1');
    expect(breakdown).toHaveTextContent('Pendientes2');
  });

  it('shows favorites and standout games in the side column, linking to each game', async () => {
    const game = (userGameId: string, name: string, shortName = 'PS5') => ({
      userGameId,
      name,
      coverUrl: null,
      platform: { shortName },
    });
    const highlights: PlayerHighlights = {
      mostPlayed: { ...game('ug-1', 'Elden Ring'), minutes: 6000 },
      fastest: {
        ...game('ug-2', 'Portal', 'PC'),
        minutes: 150,
        playthroughNumber: 2,
        playthroughName: 'Speedrun',
      },
      highestRated: { ...game('ug-1', 'Elden Ring'), rating: 98 },
      lowestRated: { ...game('ug-3', 'Anthem'), rating: 40 },
      favorites: [game('ug-2', 'Portal', 'PC'), game('ug-1', 'Elden Ring')],
    };
    const { router } = setup({
      'GET /profile/highlights': () => ({ status: 200, body: highlights }),
    });

    const aside = await screen.findByRole('complementary', { name: 'Destacados del jugador' });
    const favorites = await within(aside).findByRole('region', { name: 'Juegos favoritos' });
    expect(within(favorites).getByText('2 de 5')).toBeInTheDocument();
    expect(
      within(favorites)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual([expect.stringContaining('Portal'), expect.stringContaining('Elden Ring')]);
    const card = (name: string) => within(aside).getByRole('region', { name });
    expect(card('Juego más jugado')).toHaveTextContent('Elden Ring');
    expect(card('Juego más jugado')).toHaveTextContent('100 h');
    expect(card('Juego pasado más rápido')).toHaveTextContent('Partida #2 · Speedrun');
    expect(card('Juego pasado más rápido')).toHaveTextContent('2 h 30 min');
    expect(card('Mayor puntuación')).toHaveTextContent('98/100');
    expect(card('Menor puntuación')).toHaveTextContent('Anthem');

    await userEvent.click(within(card('Menor puntuación')).getByRole('link'));
    expect(router.state.location.pathname).toBe('/games/ug-3');
  });

  it('explains how to fill the highlights when there is no data yet', async () => {
    setup();

    const aside = await screen.findByRole('complementary', { name: 'Destacados del jugador' });
    expect(
      await within(aside).findByText('Marcá hasta 5 juegos con el corazón desde Mis juegos.'),
    ).toBeInTheDocument();
    expect(within(aside).getByRole('link', { name: 'Ir a Mis juegos' })).toHaveAttribute(
      'href',
      '/games',
    );
    expect(within(aside).getByText('Necesitás al menos dos juegos valorados.')).toBeInTheDocument();
  });

  it('invites to add games when the library is empty', async () => {
    setup({ 'GET /profile/stats': () => ({ status: 200, body: emptyStats }) });

    expect(
      await screen.findByText('Agregá juegos a tu biblioteca para ver tus estadísticas.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Todavía no valoraste juegos.')).toBeInTheDocument();
  });

  it('picks a built-in avatar', async () => {
    const { calls } = setup({
      'PUT /profile/avatar': () => ({
        status: 200,
        body: { ...testUser, avatar: { kind: 'preset', preset: 'samurai' } },
      }),
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Cambiar foto de perfil' }));
    const dialog = await screen.findByRole('dialog', { name: 'Foto de perfil' });
    expect(within(dialog).getAllByRole('radio')).toHaveLength(12);
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Samurái' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ preset: 'samurai' });
    // The header of the profile shows the new avatar (an illustration, not the initial).
    expect(
      screen.getByRole('img', { name: `Foto de perfil de ${testUser.username}` }),
    ).not.toHaveTextContent('p');
  });

  it('uploads an image from the gallery', async () => {
    const { calls } = setup({
      'PUT /profile/avatar/image': () => ({
        status: 200,
        body: { ...testUser, avatar: { kind: 'custom', url: '/api/profile/avatar/image?v=abc' } },
      }),
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Cambiar foto de perfil' }));
    const dialog = await screen.findByRole('dialog', { name: 'Foto de perfil' });
    const photo = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'me.png', {
      type: 'image/png',
    });
    await userEvent.upload(within(dialog).getByTestId('avatar-file-input'), photo);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(calls.some((c) => c.method === 'PUT' && c.path === '/profile/avatar/image')).toBe(true);
    expect(
      screen.getByRole('img', { name: `Foto de perfil de ${testUser.username}` }),
    ).toHaveAttribute('src', '/api/profile/avatar/image?v=abc');
  });

  it('rejects images over 2 MB before uploading', async () => {
    const { calls } = setup();

    await userEvent.click(await screen.findByRole('button', { name: 'Cambiar foto de perfil' }));
    const dialog = await screen.findByRole('dialog', { name: 'Foto de perfil' });
    const big = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' });
    await userEvent.upload(within(dialog).getByTestId('avatar-file-input'), big);

    expect(within(dialog).getByText('La imagen supera los 2 MB.')).toBeInTheDocument();
    expect(calls.some((c) => c.path === '/profile/avatar/image')).toBe(false);
  });

  describe('deleting the account', () => {
    it('asks for the password and explains a wrong one', async () => {
      const { calls } = setup({
        'POST /auth/delete-account': () => ({ status: 400, body: { code: 'WRONG_PASSWORD' } }),
      });
      await userEvent.click(await screen.findByRole('button', { name: 'Eliminar mi cuenta' }));
      const dialog = await screen.findByRole('dialog', { name: '¿Eliminar tu cuenta?' });
      expect(within(dialog).getByText(/no se puede deshacer/)).toBeInTheDocument();

      await userEvent.click(within(dialog).getByRole('button', { name: 'Eliminar mi cuenta' }));
      expect(calls.some((c) => c.path === '/auth/delete-account')).toBe(false);

      await userEvent.type(within(dialog).getByLabelText(/Tu contraseña/), 'wrong-pass');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Eliminar mi cuenta' }));
      expect(await within(dialog).findByText('La contraseña no es correcta.')).toBeInTheDocument();
    });

    it('deletes it and leaves the profile', async () => {
      const { calls, router } = setup({
        'POST /auth/delete-account': () => ({ status: 204 }),
      });
      await userEvent.click(await screen.findByRole('button', { name: 'Eliminar mi cuenta' }));
      const dialog = await screen.findByRole('dialog');
      await userEvent.type(within(dialog).getByLabelText(/Tu contraseña/), 'super-secret-1');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Eliminar mi cuenta' }));

      await waitFor(() =>
        expect(calls.find((c) => c.path === '/auth/delete-account')?.body).toEqual({
          password: 'super-secret-1',
        }),
      );
      await waitFor(() => expect(router.state.location.pathname).not.toBe('/profile'));
      expect(screen.queryByRole('button', { name: 'Menú de usuario' })).not.toBeInTheDocument();
    });
  });
});
