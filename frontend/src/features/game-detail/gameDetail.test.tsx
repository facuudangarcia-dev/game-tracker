import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockApi, testUser } from '../../test/mockApi';
import { renderRoute } from '../../test/renderRoute';
import type { Achievement, Difficulty, Playthrough, UserGameDetails } from '../library/types';

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
  previousMinutes: 872,
  steamMinutes: 0,
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
    favorite: false,
    createdAt: '2025-01-01T00:00:00.000Z',
    difficulty: null,
    steam: false,
    achievements: null,
    achievementList: [],
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
      'Logros',
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
          },
        ],
      }),
    );

    const notes = await screen.findByRole('region', { name: 'Notas' });
    expect(within(notes).getByText('Obra maestra')).toBeInTheDocument();
    expect(within(notes).getByText('Primera vuelta')).toBeInTheDocument();
    expect(within(notes).getByText('Nota de sesión')).toBeInTheDocument();
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

  it('shows each playthrough with its own sessions and its time', async () => {
    const second = playthrough({
      id: 'pt-2',
      number: 2,
      name: 'Nueva partida+',
      status: 'IN_PROGRESS',
      completionDate: null,
      previousMinutes: 0,
      minutes: 105,
      notes: null,
    });
    const session = (id: string, playthroughId: string, number: number, minutes: number) => ({
      id,
      playthroughId,
      playthroughNumber: number,
      playedAt: '2025-02-01T20:00:00.000Z',
      durationMinutes: minutes,
      notes: null,
    });
    renderDetail(
      buildGame({
        playthroughs: [playthrough({ minutes: 932 }), second],
        sessions: [
          session('s-1', 'pt-1', 1, 60),
          session('s-2', 'pt-2', 2, 45),
          session('s-3', 'pt-2', 2, 60),
        ],
      }),
    );

    const first = await screen.findByRole('article', { name: 'Partida #1' });
    expect(within(first).getByText('15 h 32 min')).toBeInTheDocument();
    expect(within(first).getByText('1 sesión')).toBeInTheDocument();
    // The previous time is part of its timeline.
    expect(within(first).getByText('Tiempo previo')).toBeInTheDocument();
    expect(within(first).getByText('14 h 32 min')).toBeInTheDocument();

    const nextOne = screen.getByRole('article', { name: 'Partida #2' });
    expect(within(nextOne).getByText('1 h 45 min')).toBeInTheDocument();
    expect(within(nextOne).getByText('2 sesiones')).toBeInTheDocument();
    expect(within(nextOne).getAllByRole('button', { name: /^Editar sesión/ })).toHaveLength(2);
    expect(within(nextOne).queryByText('Tiempo previo')).not.toBeInTheDocument();

    // No technical "time mode" concept anywhere.
    expect(screen.queryByText(/modo/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Pasar a/)).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Sesiones' })).not.toBeInTheDocument();
  });

  it('logs a session from a playthrough, preselecting it', async () => {
    const second = playthrough({ id: 'pt-2', number: 2, status: 'PENDING', completionDate: null });
    const game = buildGame({ playthroughs: [playthrough(), second] });
    const { calls } = renderDetail(game, {
      'POST /library/ug-1/playthroughs/pt-2/sessions': () => ({ status: 201, body: game }),
    });

    await userEvent.click(
      await screen.findByRole('button', { name: 'Registrar sesión en la partida #2' }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Registrar sesión' });
    expect(within(dialog).getByLabelText('Partida')).toHaveValue('pt-2');
    await userEvent.type(within(dialog).getByLabelText('Minutos'), '0');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));
    expect(within(dialog).getByText('La duración mínima es 1 minuto.')).toBeInTheDocument();

    await userEvent.type(within(dialog).getByLabelText('Horas'), '2');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect(calls.find((c) => c.method === 'POST')).toMatchObject({
        path: '/library/ug-1/playthroughs/pt-2/sessions',
        body: { durationMinutes: 120 },
      }),
    );
  });

  it('lets the header log a session in any playthrough (the one in progress by default)', async () => {
    const second = playthrough({
      id: 'pt-2',
      number: 2,
      status: 'IN_PROGRESS',
      completionDate: null,
    });
    renderDetail(buildGame({ playthroughs: [playthrough(), second] }));

    const header = await screen.findByRole('banner', { name: 'Bloodborne' });
    await userEvent.click(within(header).getByRole('button', { name: 'Registrar sesión' }));
    const dialog = await screen.findByRole('dialog', { name: 'Registrar sesión' });
    const select = within(dialog).getByLabelText('Partida');
    expect(select).toHaveValue('pt-2');
    expect(within(select).getAllByRole('option')).toHaveLength(2);
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

  it('allows a completed new playthrough without completion date', async () => {
    const { calls } = renderDetail(buildGame(), {
      'POST /library/ug-1/playthroughs': () => ({ status: 201, body: buildGame() }),
    });

    await userEvent.click((await screen.findAllByRole('button', { name: 'Nueva partida' }))[0]);
    const dialog = await screen.findByRole('dialog');
    await userEvent.selectOptions(within(dialog).getByLabelText('Estado'), 'Completado');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    await waitFor(() =>
      expect(calls.find((c) => c.method === 'POST')?.body).toMatchObject({
        status: 'COMPLETED',
        completionDate: null,
      }),
    );
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

  it('shows each difficulty with its level in the playthrough, platinum and lists', async () => {
    renderDetail(buildGame());

    const card = await screen.findByRole('article', { name: 'Partida #1' });
    expect(
      within(card).getByRole('img', { name: 'Dificultad: Difícil (4 de 5)' }),
    ).toBeInTheDocument();
    const platinum = screen.getByRole('region', { name: 'Platino' });
    expect(
      within(platinum).getByRole('img', { name: 'Dificultad: Fácil (2 de 5)' }),
    ).toBeInTheDocument();
    const list = screen.getByRole('region', { name: 'Dificultades de las partidas' });
    expect(
      within(list)
        .getAllByRole('img', { name: /^Dificultad:/ })
        .map((badge) => badge.getAttribute('aria-label')),
    ).toEqual([
      'Dificultad: Muy fácil (1 de 5)',
      'Dificultad: Fácil (2 de 5)',
      'Dificultad: Normal (3 de 5)',
      'Dificultad: Difícil (4 de 5)',
      'Dificultad: Muy difícil (5 de 5)',
    ]);
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

  it('edits the previous time of a playthrough', async () => {
    const { calls } = renderDetail(buildGame(), {
      'PATCH /library/ug-1/playthroughs/pt-1': () => ({ status: 200, body: buildGame() }),
    });

    const card = await screen.findByRole('article', { name: 'Partida #1' });
    await userEvent.click(within(card).getByRole('button', { name: 'Editar partida #1' }));
    const dialog = await screen.findByRole('dialog');
    const hours = within(dialog).getByLabelText('Horas');
    expect(hours).toHaveValue(14);
    expect(within(dialog).getByLabelText('Minutos')).toHaveValue(32);
    await userEvent.clear(hours);
    await userEvent.type(hours, '20');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    await waitFor(() =>
      expect(calls.find((c) => c.method === 'PATCH')?.body).toMatchObject({
        previousMinutes: 20 * 60 + 32,
      }),
    );
  });

  it("keeps Steam's time as the base when editing the time of a Steam game", async () => {
    // 20 h on Steam, -2 h of the user's own: 18 h.
    const game = buildGame({
      steam: true,
      playthroughs: [playthrough({ steamMinutes: 1200, previousMinutes: -120, minutes: 1080 })],
    });
    const { calls } = renderDetail(game, {
      'PATCH /library/ug-1/playthroughs/pt-1': () => ({ status: 200, body: game }),
    });

    const card = await screen.findByRole('article', { name: 'Partida #1' });
    await userEvent.click(
      within(card).getByRole('button', { name: 'Editar tiempo de la partida #1' }),
    );
    const form = within(card).getByRole('form', { name: 'Editar tiempo de la partida #1' });
    expect(within(form).getByLabelText('Horas')).toHaveValue(18);
    expect(within(form).getByText('Incluye 20 h de Steam.')).toBeInTheDocument();
    // 15 h in total: 3 h less than now, so -5 h on top of Steam's 20 h.
    await userEvent.clear(within(form).getByLabelText('Horas'));
    await userEvent.type(within(form).getByLabelText('Horas'), '15{Enter}');
    await waitFor(() =>
      expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ previousMinutes: -300 }),
    );

    // The playthrough dialog doesn't offer the previous time of Steam games.
    await userEvent.click(within(card).getByRole('button', { name: 'Editar partida #1' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByLabelText('Horas')).not.toBeInTheDocument();
    expect(within(dialog).getByText(/Tiempo de Steam: 20 h/)).toBeInTheDocument();
  });

  describe('achievements', () => {
    const achievement = (overrides: Partial<Achievement> = {}): Achievement => ({
      id: 'a-1',
      source: 'STEAM',
      name: 'First Blood',
      description: 'Defeat a boss',
      nameEs: 'Primera sangre',
      descriptionEs: 'Derrotá a un jefe',
      iconUrl: 'https://cdn.example/a.jpg',
      iconLockedUrl: 'https://cdn.example/a_gray.jpg',
      hidden: false,
      achieved: true,
      achievedAt: '2025-02-01T10:00:00.000Z',
      ...overrides,
    });
    const withAchievements = (list: Achievement[]) =>
      buildGame({
        achievementList: list,
        achievements: { achieved: list.filter((a) => a.achieved).length, total: list.length },
      });

    it('shows the progress and the list in the interface language, hiding secret ones', async () => {
      renderDetail(
        withAchievements([
          achievement(),
          achievement({
            id: 'a-2',
            name: 'Secret',
            nameEs: 'Secreto',
            descriptionEs: 'Encontrá el final oculto',
            hidden: true,
            achieved: false,
            achievedAt: null,
          }),
          achievement({
            id: 'a-3',
            source: 'MANUAL',
            name: 'Sin morir',
            nameEs: null,
            description: null,
            descriptionEs: null,
            iconUrl: null,
            iconLockedUrl: null,
            achieved: false,
            achievedAt: null,
          }),
        ]),
      );

      const section = await screen.findByRole('region', { name: 'Logros' });
      expect(within(section).getByText('1 de 3')).toBeInTheDocument();
      expect(within(section).getByText('33% desbloqueado')).toBeInTheDocument();
      expect(within(section).getByText('Sincronizados con Steam')).toBeInTheDocument();
      expect(within(section).getByText('Primera sangre')).toBeInTheDocument();
      expect(within(section).getByText('Derrotá a un jefe')).toBeInTheDocument();
      expect(within(section).getByText('Desbloqueado el 01/02/2025')).toBeInTheDocument();
      expect(within(section).queryByText('Encontrá el final oculto')).not.toBeInTheDocument();
      await userEvent.click(within(section).getByRole('button', { name: 'Mostrar descripción' }));
      expect(within(section).getByText('Encontrá el final oculto')).toBeInTheDocument();

      // Only the user's own can be edited or deleted.
      expect(within(section).queryByRole('button', { name: 'Editar Primera sangre' })).toBeNull();
      expect(within(section).getByRole('button', { name: 'Editar Sin morir' })).toBeInTheDocument();

      await userEvent.click(within(section).getByRole('radio', { name: 'Desbloqueados' }));
      expect(within(section).getAllByRole('checkbox')).toHaveLength(1);
    });

    it('checks achievements and adds the user’s own', async () => {
      const { calls } = renderDetail(
        withAchievements([achievement({ achieved: false, achievedAt: null })]),
        {
          'PATCH /library/ug-1/achievements/a-1': () => ({ status: 200, body: buildGame() }),
          'POST /library/ug-1/achievements': () => ({ status: 201, body: buildGame() }),
        },
      );

      const section = await screen.findByRole('region', { name: 'Logros' });
      await userEvent.click(within(section).getByRole('checkbox', { name: 'Primera sangre' }));
      await waitFor(() =>
        expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ achieved: true }),
      );

      await userEvent.click(within(section).getByRole('button', { name: 'Agregar logro' }));
      const dialog = await screen.findByRole('dialog');
      await userEvent.type(within(dialog).getByLabelText(/Nombre/), 'Sin morir');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));
      await waitFor(() =>
        expect(calls.find((c) => c.method === 'POST')?.body).toEqual({
          name: 'Sin morir',
          description: null,
        }),
      );
    });

    it('invites to add them when the game has none', async () => {
      renderDetail(buildGame());
      const section = await screen.findByRole('region', { name: 'Logros' });
      expect(within(section).getByText(/todavía no tiene logros/)).toBeInTheDocument();
    });
  });

  it('edits the playthrough time in place: the previous time absorbs the change', async () => {
    // 14 h 32 min: 2 h of sessions + 12 h 32 min of previous time.
    const game = buildGame({ playthroughs: [playthrough({ previousMinutes: 752, minutes: 872 })] });
    const { calls } = renderDetail(game, {
      'PATCH /library/ug-1/playthroughs/pt-1': () => ({ status: 200, body: buildGame() }),
    });

    const card = await screen.findByRole('article', { name: 'Partida #1' });
    await userEvent.click(
      within(card).getByRole('button', { name: 'Editar tiempo de la partida #1' }),
    );
    const form = within(card).getByRole('form', { name: 'Editar tiempo de la partida #1' });
    const hours = within(form).getByLabelText('Horas');
    expect(hours).toHaveValue(14);
    expect(within(form).getByText('Incluye 2 h de sesiones.')).toBeInTheDocument();

    // Below the sessions' time: rejected without saving.
    await userEvent.clear(hours);
    await userEvent.type(hours, '1');
    await userEvent.click(within(form).getByRole('button', { name: 'Guardar' }));
    expect(
      within(form).getByText('No puede ser menor que el tiempo de sus sesiones (2 h).'),
    ).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);

    await userEvent.clear(hours);
    await userEvent.type(hours, '20{Enter}');
    await waitFor(() =>
      expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({
        previousMinutes: 20 * 60 + 32 - 120,
      }),
    );
    await waitFor(() => expect(within(card).queryByRole('form')).not.toBeInTheDocument());
  });

  it('changes the playthrough difficulty in place', async () => {
    const { calls } = renderDetail(buildGame(), {
      'PATCH /library/ug-1/playthroughs/pt-1': () => ({ status: 200, body: buildGame() }),
    });

    const card = await screen.findByRole('article', { name: 'Partida #1' });
    await userEvent.click(
      within(card).getByRole('button', { name: 'Editar dificultad de la partida #1' }),
    );
    const select = within(card).getByRole('combobox', { name: 'Dificultad' });
    expect(select).toHaveValue('PLAYTHROUGH-3');
    await userEvent.selectOptions(select, 'Muy difícil');

    await waitFor(() =>
      expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({
        difficultyId: 'PLAYTHROUGH-4',
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
