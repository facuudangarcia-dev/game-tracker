import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import type { DataSource } from 'typeorm';
import { latestAllowedDate } from '../src/common/dates';
import { DifficultyKind } from '../src/library/difficulty.entity';
import type { DifficultyResponseDto } from '../src/library/dto/difficulty.dto';
import type { UserGameDetailsDto } from '../src/library/dto/user-game-response.dto';
import { Platform } from '../src/platforms/platform.entity';
import { createTestApp } from './create-test-app';
import { as, registerUser, type TestUser } from './test-users';

describe('Playthroughs and difficulties (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let resetDatabase: () => Promise<void>;
  let alice: TestUser;
  let bob: TestUser;
  let game: UserGameDetailsDto;

  const tomorrowAnywhere = () => {
    const date = new Date(`${latestAllowedDate()}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString().slice(0, 10);
  };

  beforeAll(async () => {
    ({ app, dataSource, resetDatabase } = await createTestApp());
  });

  async function addManualGame(user: TestUser, name = 'Homebrew'): Promise<UserGameDetailsDto> {
    const pc = await dataSource.getRepository(Platform).findOneByOrFail({ slug: 'pc' });
    return (
      await as(app, user)
        .post('/api/library', { manualGame: { name }, platformId: pc.id })
        .expect(201)
    ).body as UserGameDetailsDto;
  }

  beforeEach(async () => {
    await resetDatabase();
    alice = await registerUser(app, 'alice@example.com');
    bob = await registerUser(app, 'bob@example.com');
    game = await addManualGame(alice);
  });

  afterAll(async () => {
    await app.close();
  });

  const url = (path = '') => `/api/library/${game.id}${path}`;
  const first = () => game.playthroughs[0];
  const createPlaythrough = (body: object = {}) => as(app, alice).post(url('/playthroughs'), body);
  const patchPlaythrough = (id: string, body: object) =>
    as(app, alice).patch(url(`/playthroughs/${id}`), body);
  const playthroughDifficulties = (g: UserGameDetailsDto) =>
    g.difficulties.filter((d) => d.kind === DifficultyKind.Playthrough);

  describe('defaults', () => {
    it('starts with playthrough #1 and the default difficulty list', () => {
      expect(game.playthroughs.map((p) => p.number)).toEqual([1]);
      expect(playthroughDifficulties(game).map((d) => d.name)).toEqual([
        'Muy fácil',
        'Fácil',
        'Normal',
        'Difícil',
        'Muy difícil',
      ]);
      expect(game.difficulties.every((d) => !d.inUse)).toBe(true);
    });
  });

  describe('creating and deleting playthroughs', () => {
    it('numbers new playthroughs automatically', async () => {
      const second = (
        await createPlaythrough({
          name: 'NG+',
          status: 'IN_PROGRESS',
          startDate: '2026-01-02',
        }).expect(201)
      ).body as UserGameDetailsDto;

      expect(second.playthroughs.map((p) => [p.number, p.name, p.status])).toEqual([
        [1, null, 'PENDING'],
        [2, 'NG+', 'IN_PROGRESS'],
      ]);
      expect(second.playthroughs[1]).toMatchObject({ previousMinutes: 0, minutes: 0 });
      expect(second.status).toBe('IN_PROGRESS');
    });

    it('assigns distinct numbers under concurrent creation', async () => {
      await Promise.all([createPlaythrough(), createPlaythrough(), createPlaythrough()]);

      const body = (await as(app, alice).get(url()).expect(200)).body as UserGameDetailsDto;
      expect(body.playthroughs.map((p) => p.number)).toEqual([1, 2, 3, 4]);
    });

    it('deletes later playthroughs but never #1', async () => {
      const withSecond = (await createPlaythrough().expect(201)).body as UserGameDetailsDto;

      const refused = await as(app, alice)
        .delete(url(`/playthroughs/${first().id}`))
        .expect(409);
      expect(refused.body).toMatchObject({ code: 'FIRST_PLAYTHROUGH_NOT_DELETABLE' });

      const afterDelete = (
        await as(app, alice)
          .delete(url(`/playthroughs/${withSecond.playthroughs[1].id}`))
          .expect(200)
      ).body as UserGameDetailsDto;
      expect(afterDelete.playthroughs.map((p) => p.number)).toEqual([1]);
    });

    it('lists playthroughs', async () => {
      await createPlaythrough({ name: 'Second' }).expect(201);
      const list = (await as(app, alice).get(url('/playthroughs')).expect(200)).body as {
        number: number;
      }[];
      expect(list.map((p) => p.number)).toEqual([1, 2]);
    });
  });

  describe('status and dates', () => {
    it.each([
      [{ status: 'IN_PROGRESS', completionDate: '2025-01-01' }, 'COMPLETION_DATE_NOT_ALLOWED'],
      [{ completionDate: '2025-01-01' }, 'COMPLETION_DATE_NOT_ALLOWED'],
      [
        { status: 'COMPLETED', startDate: '2025-02-01', completionDate: '2025-01-31' },
        'COMPLETION_BEFORE_START',
      ],
    ])('rejects %j with %s', async (body, code) => {
      const response = await patchPlaythrough(first().id, body).expect(400);
      expect(response.body).toMatchObject({ code });
    });

    it('allows completing a playthrough without a completion date', async () => {
      const response = await patchPlaythrough(first().id, { status: 'COMPLETED' }).expect(200);
      expect(response.body).toMatchObject({ status: 'COMPLETED', completionDate: null });
    });

    it('rejects a future completion date but allows a future start date', async () => {
      const tomorrow = tomorrowAnywhere();

      const future = await patchPlaythrough(first().id, {
        status: 'COMPLETED',
        completionDate: tomorrow,
      }).expect(400);
      expect(future.body).toMatchObject({ code: 'DATE_IN_FUTURE' });
      await patchPlaythrough(first().id, { startDate: tomorrow }).expect(200);
    });

    it.each([['2025-02-30'], ['2025-1-01'], ['yesterday'], [20250101]])(
      'rejects malformed date %p',
      async (startDate) => {
        await patchPlaythrough(first().id, { startDate }).expect(400);
      },
    );

    it('rejects clearing the status', async () => {
      await patchPlaythrough(first().id, { status: null }).expect(400);
    });

    it('clears only the completion date when leaving COMPLETED, keeping the rest', async () => {
      await patchPlaythrough(first().id, {
        name: 'Main run',
        status: 'COMPLETED',
        startDate: '2025-01-01',
        completionDate: '2025-02-01',
        notes: 'Great ending',
      }).expect(200);

      const body = (await patchPlaythrough(first().id, { status: 'IN_PROGRESS' }).expect(200))
        .body as UserGameDetailsDto;

      expect(body.playthroughs[0]).toMatchObject({
        name: 'Main run',
        status: 'IN_PROGRESS',
        startDate: '2025-01-01',
        completionDate: null,
        notes: 'Great ending',
      });
    });

    it('has a PLAYED status, without completion date, ranked between COMPLETED and PENDING', async () => {
      const played = (
        await patchPlaythrough(first().id, { status: 'PLAYED', startDate: '2025-01-01' }).expect(
          200,
        )
      ).body as UserGameDetailsDto;
      expect(played).toMatchObject({ status: 'PLAYED', completionDate: null });
      expect(played.playthroughs[0]).toMatchObject({ status: 'PLAYED', startDate: '2025-01-01' });
      await patchPlaythrough(first().id, { completionDate: '2025-02-01' }).expect(400);

      // PENDING < PLAYED < COMPLETED < IN_PROGRESS.
      const second = (await createPlaythrough({}).expect(201)).body as UserGameDetailsDto;
      expect(second.status).toBe('PLAYED');
      const id = second.playthroughs[1].id;
      const completed = (await patchPlaythrough(id, { status: 'COMPLETED' }).expect(200))
        .body as UserGameDetailsDto;
      expect(completed.status).toBe('COMPLETED');
      const playing = (await patchPlaythrough(id, { status: 'IN_PROGRESS' }).expect(200))
        .body as UserGameDetailsDto;
      expect(playing.status).toBe('IN_PROGRESS');

      const list = (await as(app, alice).get('/api/library?status=PLAYED').expect(200))
        .body as unknown[];
      expect(list).toHaveLength(0);
      await patchPlaythrough(id, { status: 'PENDING' }).expect(200);
      expect(
        ((await as(app, alice).get('/api/library?status=PLAYED').expect(200)).body as unknown[])
          .length,
      ).toBe(1);
    });

    it('derives the game completion from the FIRST completed playthrough', async () => {
      await patchPlaythrough(first().id, {
        status: 'COMPLETED',
        startDate: '2025-01-01',
        completionDate: '2025-03-01',
      }).expect(200);
      const body = (
        await createPlaythrough({
          name: 'NG+',
          status: 'COMPLETED',
          startDate: '2026-01-01',
          completionDate: '2026-02-01',
        }).expect(201)
      ).body as UserGameDetailsDto;

      expect(body).toMatchObject({
        status: 'COMPLETED',
        startDate: '2025-01-01',
        completionDate: '2025-03-01',
      });
    });
  });

  describe('name and notes', () => {
    it('trims names, stores blank ones as null and limits their length', async () => {
      const body = (await patchPlaythrough(first().id, { name: '  Hard run ' }).expect(200))
        .body as UserGameDetailsDto;
      expect(body.playthroughs[0].name).toBe('Hard run');

      const cleared = (await patchPlaythrough(first().id, { name: '  ' }).expect(200))
        .body as UserGameDetailsDto;
      expect(cleared.playthroughs[0].name).toBeNull();
      await patchPlaythrough(first().id, { name: 'x'.repeat(101) }).expect(400);
    });

    it('limits playthrough notes to 5000 characters', async () => {
      await patchPlaythrough(first().id, { notes: 'x'.repeat(5000) }).expect(200);
      await patchPlaythrough(first().id, { notes: 'x'.repeat(5001) }).expect(400);
    });
  });

  describe('difficulty of a playthrough', () => {
    it('assigns a difficulty of the same game and marks it as in use', async () => {
      const hard = playthroughDifficulties(game)[3];

      const body = (await patchPlaythrough(first().id, { difficultyId: hard.id }).expect(200))
        .body as UserGameDetailsDto;

      expect(body.playthroughs[0].difficulty).toEqual({ id: hard.id, name: 'Difícil' });
      expect(body.difficulties.find((d) => d.id === hard.id)?.inUse).toBe(true);
    });

    it("rejects another game's difficulty", async () => {
      const other = await addManualGame(alice, 'Other');

      const response = await patchPlaythrough(first().id, {
        difficultyId: playthroughDifficulties(other)[0].id,
      }).expect(400);
      expect(response.body).toMatchObject({ code: 'DIFFICULTY_NOT_FOUND' });
    });

    it('clears the difficulty with null', async () => {
      await patchPlaythrough(first().id, {
        difficultyId: playthroughDifficulties(game)[0].id,
      }).expect(200);
      const body = (await patchPlaythrough(first().id, { difficultyId: null }).expect(200))
        .body as UserGameDetailsDto;
      expect(body.playthroughs[0].difficulty).toBeNull();
    });
  });

  describe('difficulty lists', () => {
    const difficultiesUrl = (path = '') => url(`/difficulties${path}`);
    const names = (list: DifficultyResponseDto[]) =>
      list.filter((d) => d.kind === DifficultyKind.Playthrough).map((d) => d.name);

    it('adds custom difficulties at the end and rejects duplicate names', async () => {
      const list = (
        await as(app, alice)
          .post(difficultiesUrl(), { kind: 'PLAYTHROUGH', name: ' Friendly Neighborhood ' })
          .expect(201)
      ).body as DifficultyResponseDto[];

      expect(names(list).at(-1)).toBe('Friendly Neighborhood');
      const duplicate = await as(app, alice)
        .post(difficultiesUrl(), { kind: 'PLAYTHROUGH', name: 'normal' })
        .expect(409);
      expect(duplicate.body).toMatchObject({ code: 'DIFFICULTY_NAME_TAKEN' });
      await as(app, alice).post(difficultiesUrl(), { kind: 'PLAYTHROUGH', name: '  ' }).expect(400);
    });

    it('supports a completely custom list', async () => {
      for (const difficulty of playthroughDifficulties(game)) {
        await as(app, alice)
          .delete(difficultiesUrl(`/${difficulty.id}`))
          .expect(200);
      }
      for (const name of ['Easy', 'Normal', 'Hard']) {
        await as(app, alice).post(difficultiesUrl(), { kind: 'PLAYTHROUGH', name }).expect(201);
      }

      const list = (await as(app, alice).get(difficultiesUrl()).expect(200))
        .body as DifficultyResponseDto[];
      expect(names(list)).toEqual(['Easy', 'Normal', 'Hard']);
    });

    it('renames difficulties, including one in use, avoiding duplicates', async () => {
      const [easy, , normal] = playthroughDifficulties(game);
      await patchPlaythrough(first().id, { difficultyId: normal.id }).expect(200);

      const list = (
        await as(app, alice)
          .patch(difficultiesUrl(`/${normal.id}`), { name: 'Amazing' })
          .expect(200)
      ).body as DifficultyResponseDto[];
      expect(names(list)).toContain('Amazing');

      await as(app, alice)
        .patch(difficultiesUrl(`/${easy.id}`), { name: 'AMAZING' })
        .expect(409);
      const detail = (await as(app, alice).get(url()).expect(200)).body as UserGameDetailsDto;
      expect(detail.playthroughs[0].difficulty?.name).toBe('Amazing');
    });

    it('refuses to delete a difficulty in use, until it is no longer used', async () => {
      const hard = playthroughDifficulties(game)[3];
      await patchPlaythrough(first().id, { difficultyId: hard.id }).expect(200);

      const refused = await as(app, alice)
        .delete(difficultiesUrl(`/${hard.id}`))
        .expect(409);
      expect(refused.body).toMatchObject({ code: 'DIFFICULTY_IN_USE' });
      await expect(
        dataSource.query('DELETE FROM difficulties WHERE id = $1', [hard.id]),
      ).rejects.toThrow(/foreign key/);

      await patchPlaythrough(first().id, { difficultyId: null }).expect(200);
      await as(app, alice)
        .delete(difficultiesUrl(`/${hard.id}`))
        .expect(200);
    });

    it('reorders a whole list', async () => {
      const ids = playthroughDifficulties(game).map((d) => d.id);

      const list = (
        await as(app, alice)
          .put(difficultiesUrl('/order'), { kind: 'PLAYTHROUGH', ids: [...ids].reverse() })
          .expect(200)
      ).body as DifficultyResponseDto[];

      expect(names(list)).toEqual(['Muy difícil', 'Difícil', 'Normal', 'Fácil', 'Muy fácil']);
    });

    it.each([
      ['a partial list', (ids: string[]) => ids.slice(1)],
      ['duplicated ids', (ids: string[]) => [...ids.slice(1), ids[1]]],
      [
        'a foreign id',
        (ids: string[]) => [...ids.slice(1), '00000000-0000-4000-8000-000000000000'],
      ],
    ])('rejects reordering with %s', async (_case, build) => {
      const ids = playthroughDifficulties(game).map((d) => d.id);
      await as(app, alice)
        .put(difficultiesUrl('/order'), { kind: 'PLAYTHROUGH', ids: build(ids) })
        .expect(400);
    });

    it('deletes the lists with the game, even if a difficulty is in use', async () => {
      await patchPlaythrough(first().id, {
        difficultyId: playthroughDifficulties(game)[0].id,
      }).expect(200);

      await as(app, alice).delete(url()).expect(204);

      await expect(
        dataSource.query('SELECT count(*)::int AS n FROM difficulties WHERE user_game_id = $1', [
          game.id,
        ]),
      ).resolves.toEqual([{ n: 0 }]);
    });
  });

  describe('ownership', () => {
    it("blocks every playthrough and difficulty operation on another user's game", async () => {
      const asBob = as(app, bob);
      const difficultyId = game.difficulties[0].id;

      await asBob.get(url('/playthroughs')).expect(404);
      await asBob.post(url('/playthroughs'), {}).expect(404);
      await asBob.patch(url(`/playthroughs/${first().id}`), { name: 'x' }).expect(404);
      await asBob.delete(url(`/playthroughs/${first().id}`)).expect(404);
      await asBob.get(url('/difficulties')).expect(404);
      await asBob.post(url('/difficulties'), { kind: 'PLAYTHROUGH', name: 'x' }).expect(404);
      await asBob.patch(url(`/difficulties/${difficultyId}`), { name: 'x' }).expect(404);
      await asBob.delete(url(`/difficulties/${difficultyId}`)).expect(404);
      await asBob
        .put(url('/difficulties/order'), { kind: 'PLAYTHROUGH', ids: [difficultyId] })
        .expect(404);
    });

    it("can't reach another user's playthrough through one's own game", async () => {
      const bobsGame = await addManualGame(bob, 'Bob game');

      const response = await as(app, bob)
        .patch(`/api/library/${bobsGame.id}/playthroughs/${first().id}`, { name: 'hijack' })
        .expect(404);
      expect(response.body).toMatchObject({ code: 'PLAYTHROUGH_NOT_FOUND' });
      await as(app, bob)
        .patch(`/api/library/${bobsGame.id}/difficulties/${game.difficulties[0].id}`, {
          name: 'hijack',
        })
        .expect(404);
    });
  });
});
