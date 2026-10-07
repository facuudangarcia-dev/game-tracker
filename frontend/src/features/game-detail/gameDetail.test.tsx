import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockApi, testUser } from '../../test/mockApi';
import { renderRoute } from '../../test/renderRoute';
import type { Difficulty, Playthrough, UserGameDetails } from '../library/types';

const difficulties = (kind: 'PLAYTHROUGH' | 'PLATINUM', inUseIndex = -1): Difficulty[] =>
  ['Muy fácil', 'Fácil', 'Normal', 'Difícil', 'Muy difícil'].map((name, position) => ({
    id: `${kind}-${position}`,
    kind,
    name,
    position,
    inUse: position === inUseIndex,
  }));

const playthrough = (overrides: Partial<Playthrough> = {}): Playthrough => ({
  id: 'pt-1',
  number: 1,
  name: null,
  status: 'COMPLETED',
  startDate: '2025-01-01',
  completionDate: '2025-03-01',
  difficulty: { id: 'PLAYTHROUGH-3', name: 'Difícil' },
  timeMode: 'MANUAL',
  manualTimeMinutes: 872,
  minutes: 872,
  notes: 'Primera vuelta',
  createdAt: '2025-01-01T00:00:00.000Z',
  ...overrides,
});

function buildGame(overrides: Partial<UserGameDetails> = {}): UserGameDetails {
  return {
    id: 'ug-1',
    game: {
      id: 'g-1',
      name: 'Bloodborne',
      coverUrl: null,
      isManual: false,
      provider: null,
      externalId: null,
      slug: 'bloodborne',
      summary: 'Hunt or be hunted.',
      releaseDate: '2015-03-24',
      developers: ['FromSoftware'],
      publishers: ['Sony'],
      genres: [{ id: 'gen-1', slug: 'role-playing', name: 'Rol (RPG)' }],
    },
    platform: { id: 'p-ps4', slug: 'ps4', name: 'PlayStation 4', shortName: 'PS4' },
    status: 'COMPLETED',
    startDate: '2025-01-01',
    completionDate: '2025-03-01',
    totalMinutes: 872,
    rating: 95,
    platinumAchieved: true,
    createdAt: '2025-01-01T00:00:00.000Z',
    notes: 'Obra maestra',
    platinum: {
      achieved: true,
      date: '2025-04-01',
      timeMinutes: 4320,
      difficulty: { id: 'PLATINUM-1', name: 'Fácil' },
    },
    playthroughs: [playthrough()],
    sessions: [],
    difficulties: [...difficulties('PLAYTHROUGH', 3), ...difficulties('PLATINUM', 1)],
    ...overrides,
  };
}

const me = () => ({ status: 200, body: testUser });

function renderDetail(game: UserGameDetails, handlers: Parameters<typeof mockApi>[0] = {}) {
  const api = mockApi({
    'GET /auth/me': me,
    'GET /library/ug-1': () => ({ status: 200, body: game }),
    ...handlers,
  });
  const view = renderRoute('/games/ug-1');
  return { ...api, ...view };
}

describe('game detail page', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the header and the sections in the defined order, without tabs', async () => {
    renderDetail(buildGame());

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Bloodborne' }),
    ).toBeInTheDocument();
    const header = screen.getByRole('banner', { name: 'Bloodborne' });
    expect(within(header).getByText('PlayStation 4')).toBeInTheDocument();
    expect(within(header).getByText('Completado')).toBeInTheDocument();
    expect(within(header).getByText('Tiempo total')).toBeInTheDocument();
    expect(within(header).getByText('14 h 32 min')).toBeInTheDocument();
    expect(within(header).getByText('95/100')).toBeInTheDocument();
    expect(within(header).getByText('Platino')).toBeInTheDocument();

    const sectionTitles = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(sectionTitles).toEqual([
      'Mi juego',
      'Partidas',
      'Sesiones',
      'Notas',
      'Platino',
      'Dificultades',
    ]);
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it("uses the catalog's artwork behind the header, and none is requested for manual games", async () => {
    const base = buildGame();
    const { calls } = renderDetail(
      { ...base, game: { ...base.game, provider: 'igdb', externalId: '7334' } },
      {
        'GET /catalog/games/igdb/7334': () => ({
          status: 200,
          body: { artworkUrl: '/api/catalog/igdb/images/arbb?size=artwork' },
        }),
      },
    );

    const header = await screen.findByRole('banner', { name: 'Bloodborne' });
    await waitFor(() =>
      expect(
        header.querySelector('img[src="/api/catalog/igdb/images/arbb?size=artwork"]'),
      ).not.toBeNull(),
    );
    expect(calls.filter((c) => c.path.startsWith('/catalog/games/'))).toHaveLength(1);
  });

  it('does not ask the catalog for a manual game', async () => {
    const base = buildGame();
    const { calls } = renderDetail({ ...base, game: { ...base.game, isManual: true } });

    await screen.findByRole('heading', { level: 1, name: 'Bloodborne' });
    expect(calls.some((c) => c.path.startsWith('/catalog/'))).toBe(false);
  });

  it('shows the three note levels', async () => {
    renderDetail(
      buildGame({
        sessions: [
          {
            id: 's-1',
            playthroughId: 'pt-1',
            playthroughNumber: 1,
            playedAt: '2025-02-01T20:00:00.000Z',
            durationMinutes: 60,
            notes: 'Nota de sesión',
            countsTowardTime: false,
          },
        ],
      }),
    );

    const notes = await screen.findByRole('region', { name: 'Notas' });
    expect(within(notes).getByText('Obra maestra')).toBeInTheDocument();
    expect(within(notes).getByText('Primera vuelta')).toBeInTheDocument();
    expect(within(notes).getByText('Nota de sesión')).toBeInTheDocument();
    expect(screen.getByText('No cuenta (modo manual)')).toBeInTheDocument();
  });

  it('never allows deleting playthrough #1, and confirms before deleting others', async () => {
    const second = playthrough({ id: 'pt-2', number: 2, status: 'PENDING', completionDate: null });
    const { calls } = renderDetail(buildGame({ playthroughs: [playthrough(), second] }), {
      'DELETE /library/ug-1/playthroughs/pt-2': () => ({ status: 200, body: buildGame() }),
    });

    expect(await screen.findByRole('button', { name: 'Eliminar partida #1' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar partida #2' }));
    const dialog = await screen.findByRole('dialog');
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);

    await userEvent.click(within(dialog).getByRole('button', { name: 'Eliminar' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE')).toBe(true));
  });

  it('only allows logging sessions when a playthrough is in SESSIONS mode', async () => {
    renderDetail(buildGame());
    const buttons = await screen.findAllByRole('button', { name: 'Registrar sesión' });
    buttons.forEach((button) => expect(button).toBeDisabled());
  });

  it('logs a session on a SESSIONS playthrough', async () => {
    const game = buildGame({
      playthroughs: [playthrough({ timeMode: 'SESSIONS', minutes: 0 })],
    });
    const { calls } = renderDetail(game, {
      'POST /library/ug-1/playthroughs/pt-1/sessions': () => ({ status: 201, body: game }),
    });

    await userEvent.click((await screen.findAllByRole('button', { name: 'Registrar sesión' }))[0]);
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Minutos'), '0');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));
    expect(within(dialog).getByText('La duración mínima es 1 minuto.')).toBeInTheDocument();

    await userEvent.type(within(dialog).getByLabelText('Horas'), '2');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect(calls.find((c) => c.method === 'POST')?.body).toMatchObject({ durationMinutes: 120 }),
    );
  });

  it('validates the rating before saving the game', async () => {
    const { calls } = renderDetail(buildGame(), {
      'PATCH /library/ug-1': () => ({ status: 200, body: buildGame({ rating: 90 }) }),
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Editar juego' }));
    const dialog = await screen.findByRole('dialog');
    const rating = within(dialog).getByLabelText('Valoración (10-100)');
    await userEvent.clear(rating);
    await userEvent.type(rating, '101');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));
    expect(
      within(dialog).getByText('Ingresá un número entero entre 10 y 100.'),
    ).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);

    await userEvent.clear(rating);
    await userEvent.type(rating, '90');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({
        rating: 90,
        notes: 'Obra maestra',
      }),
    );
  });

  it('requires a completion date for a completed new playthrough', async () => {
    const { calls } = renderDetail(buildGame(), {
      'POST /library/ug-1/playthroughs': () => ({ status: 201, body: buildGame() }),
    });

    await userEvent.click((await screen.findAllByRole('button', { name: 'Nueva partida' }))[0]);
    const dialog = await screen.findByRole('dialog');
    await userEvent.selectOptions(within(dialog).getByLabelText('Estado'), 'Completado');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    expect(
      within(dialog).getByText('Una partida completada requiere fecha de finalización.'),
    ).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('disables platinum fields until it is marked as achieved', async () => {
    renderDetail(
      buildGame({
        platinumAchieved: false,
        platinum: { achieved: false, date: null, timeMinutes: null, difficulty: null },
      }),
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Editar platino' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Fecha del platino')).toBeDisabled();
    expect(within(dialog).getByLabelText('Dificultad del platino')).toBeDisabled();

    await userEvent.click(within(dialog).getByLabelText('Platino conseguido'));
    expect(within(dialog).getByLabelText(/Fecha del platino/)).toBeEnabled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));
    expect(within(dialog).getByText('Este campo es obligatorio.')).toBeInTheDocument();
  });

  it('separates both difficulty lists and protects difficulties in use', async () => {
    renderDetail(buildGame());

    const playthroughList = await screen.findByRole('region', {
      name: 'Dificultades de las partidas',
    });
    const platinumList = screen.getByRole('region', { name: 'Dificultades del platino' });
    expect(
      within(playthroughList).getByRole('button', { name: 'Eliminar Difícil' }),
    ).toBeDisabled();
    expect(within(playthroughList).getByRole('button', { name: 'Eliminar Normal' })).toBeEnabled();
    expect(within(platinumList).getByRole('button', { name: 'Eliminar Fácil' })).toBeDisabled();
    expect(within(playthroughList).getByRole('button', { name: 'Subir Muy fácil' })).toBeDisabled();
  });

  it('reorders a difficulty list', async () => {
    const { calls } = renderDetail(buildGame(), {
      'PUT /library/ug-1/difficulties/order': () => ({
        status: 200,
        body: buildGame().difficulties,
      }),
    });

    const list = await screen.findByRole('region', { name: 'Dificultades de las partidas' });
    await userEvent.click(within(list).getByRole('button', { name: 'Bajar Muy fácil' }));

    await waitFor(() =>
      expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({
        kind: 'PLAYTHROUGH',
        ids: ['PLAYTHROUGH-1', 'PLAYTHROUGH-0', 'PLAYTHROUGH-2', 'PLAYTHROUGH-3', 'PLAYTHROUGH-4'],
      }),
    );
  });

  it('offers to keep the manual time as a session when switching to SESSIONS', async () => {
    const { calls } = renderDetail(buildGame(), {
      'PUT /library/ug-1/playthroughs/pt-1/time-mode': () => ({ status: 200, body: buildGame() }),
    });

    await userEvent.click(
      await screen.findByRole('button', { name: 'Cambiar modo de tiempo de la partida #1' }),
    );
    const dialog = await screen.findByRole('dialog');
    const keep = within(dialog).getByRole('checkbox', { name: /sesión inicial/ });
    expect(keep).toBeChecked();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Pasar a sesiones' }));

    await waitFor(() =>
      expect(calls.find((c) => c.method === 'PUT')?.body).toMatchObject({
        mode: 'SESSIONS',
        initialSession: { playedAt: expect.any(String) as string },
      }),
    );
  });

  it('confirms before deleting the game and returns to the library', async () => {
    const { calls, router } = renderDetail(buildGame(), {
      'DELETE /library/ug-1': () => ({ status: 204 }),
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Eliminar juego' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/no se puede deshacer/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Eliminar' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/games'));
    expect(calls.some((c) => c.method === 'DELETE' && c.path === '/library/ug-1')).toBe(true);
  });

  it('shows the dialogs with their title and the game as context, closable without acting', async () => {
    const { calls } = renderDetail(buildGame());

    await userEvent.click(await screen.findByRole('button', { name: 'Eliminar juego' }));
    const confirm = await screen.findByRole('dialog', { name: 'Eliminar juego' });
    expect(within(confirm).getByText('Bloodborne')).toBeInTheDocument();
    await userEvent.click(within(confirm).getByRole('button', { name: 'Cerrar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: 'Editar juego' }));
    const edit = await screen.findByRole('dialog', { name: 'Editar juego' });
    expect(within(edit).getByText('Bloodborne')).toBeInTheDocument();
    await userEvent.click(within(edit).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);
  });

  it('explains when the game is not in the library', async () => {
    mockApi({
      'GET /auth/me': me,
      'GET /library/missing': () => ({ status: 404, body: { code: 'USER_GAME_NOT_FOUND' } }),
    });
    renderRoute('/games/missing');

    expect(await screen.findByText('Este juego no está en tu biblioteca.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver a Mis juegos' })).toBeInTheDocument();
  });
});
