import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import type { DataSource } from 'typeorm';
import { latestAllowedDate } from '../src/common/dates';
import { DifficultyKind } from '../src/library/difficulty.entity';
import type {
  UserGameDetailsDto,
  UserGameListItemDto,
} from '../src/library/dto/user-game-response.dto';
import { Platform } from '../src/platforms/platform.entity';
import { createTestApp } from './create-test-app';
import { as, registerUser, type TestUser } from './test-users';

describe('Platinum (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let resetDatabase: () => Promise<void>;
  let alice: TestUser;
  let bob: TestUser;
  let game: UserGameDetailsDto;

  beforeAll(async () => {
    ({ app, dataSource, resetDatabase } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase();
    alice = await registerUser(app, 'alice@example.com');
    bob = await registerUser(app, 'bob@example.com');
    const ps5 = await dataSource.getRepository(Platform).findOneByOrFail({ slug: 'ps5' });
    game = (
      await as(app, alice)
        .post('/api/library', { manualGame: { name: 'Bloodborne' }, platformId: ps5.id })
        .expect(201)
    ).body as UserGameDetailsDto;
  });

  afterAll(async () => {
    await app.close();
  });

  const url = (path = '') => `/api/library/${game.id}${path}`;
  const putPlatinum = (body: object) => as(app, alice).put(url('/platinum'), body);
  const listOf = (g: UserGameDetailsDto, kind: DifficultyKind) =>
    g.difficulties.filter((d) => d.kind === kind);
  const platinumEasy = () => listOf(game, DifficultyKind.Platinum)[1];
  const patchFirst = (body: object) =>
    as(app, alice).patch(url(`/playthroughs/${game.playthroughs[0].id}`), body);

  it('starts without platinum and with its own independent difficulty list', async () => {
    expect(game.platinum).toEqual({
      achieved: false,
      date: null,
      timeMinutes: null,
      difficulty: null,
    });
    const platinumList = listOf(game, DifficultyKind.Platinum);
    const playthroughList = listOf(game, DifficultyKind.Playthrough);
    expect(platinumList.map((d) => d.name)).toEqual(playthroughList.map((d) => d.name));
    expect(platinumList.map((d) => d.id)).not.toEqual(
      expect.arrayContaining(playthroughList.map((d) => d.id)),
    );

    await as(app, alice).get(url('/platinum')).expect(200, game.platinum);
  });

  it('records the platinum with date, manual time and platinum difficulty', async () => {
    const body = (
      await putPlatinum({
        achieved: true,
        date: '2025-04-10',
        timeMinutes: 4320,
        difficultyId: platinumEasy().id,
      }).expect(200)
    ).body as UserGameDetailsDto;

    expect(body.platinum).toEqual({
      achieved: true,
      date: '2025-04-10',
      timeMinutes: 4320,
      difficulty: { id: platinumEasy().id, name: 'Fácil' },
    });
    // Platinum time never mixes with playtime.
    expect(body.totalMinutes).toBe(0);
    const list = (await as(app, alice).get('/api/library').expect(200))
      .body as UserGameListItemDto[];
    expect(list[0].platinumAchieved).toBe(true);
  });

  it('checks every pending achievement on the platinum date and leaves them when removed', async () => {
    const add = (name: string) => as(app, alice).post(url('/achievements'), { name }).expect(201);
    await add('Sin morir');
    const withTwo = (await add('Speedrun')).body as UserGameDetailsDto;
    const early = withTwo.achievementList[0];
    await as(app, alice)
      .patch(url(`/achievements/${early.id}`), { achieved: true })
      .expect(200);
    const earlyAt = ((await as(app, alice).get(url()).expect(200)).body as UserGameDetailsDto)
      .achievementList[0].achievedAt;

    const body = (
      await putPlatinum({ achieved: true, date: '2025-04-10', timeMinutes: 60 }).expect(200)
    ).body as UserGameDetailsDto;
    expect(body.achievementList.map((a) => [a.achieved, a.achievedAt])).toEqual([
      [true, earlyAt],
      [true, '2025-04-10T00:00:00.000Z'],
    ]);
    expect(body.achievements).toEqual({ achieved: 2, total: 2 });

    const removed = (await putPlatinum({ achieved: false }).expect(200)).body as UserGameDetailsDto;
    expect(removed.achievementList.every((a) => a.achieved)).toBe(true);
  });

  it.each([
    [{ achieved: true, timeMinutes: 60 }, 'PLATINUM_DATE_REQUIRED'],
    [{ achieved: true, date: '2025-01-01' }, 'PLATINUM_TIME_REQUIRED'],
    [{ achieved: true, date: '2025-01-01', timeMinutes: null }, 'PLATINUM_TIME_REQUIRED'],
  ])('requires date and time when achieved: %j', async (body, code) => {
    const response = await putPlatinum(body).expect(400);
    expect(response.body).toMatchObject({ code });
  });

  it.each([
    [{ achieved: 'yes' }],
    [{ achieved: true, date: '2025-01-01', timeMinutes: 0 }],
    [{ achieved: true, date: '2025-01-01', timeMinutes: 10.5 }],
    [{ achieved: true, date: '01/01/2025', timeMinutes: 10 }],
    [{}],
  ])('validates %j', async (body) => {
    await putPlatinum(body).expect(400);
  });

  it('rejects a future platinum date', async () => {
    const tomorrow = new Date(`${latestAllowedDate()}T00:00:00Z`);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    const response = await putPlatinum({
      achieved: true,
      date: tomorrow.toISOString().slice(0, 10),
      timeMinutes: 10,
    }).expect(400);
    expect(response.body).toMatchObject({ code: 'DATE_IN_FUTURE' });
  });

  describe('platinum date vs game start date', () => {
    it('rejects a platinum before the earliest playthrough start', async () => {
      await patchFirst({ startDate: '2025-06-01' }).expect(200);

      const response = await putPlatinum({
        achieved: true,
        date: '2025-05-31',
        timeMinutes: 10,
      }).expect(400);
      expect(response.body).toMatchObject({ code: 'PLATINUM_BEFORE_START' });
      await putPlatinum({ achieved: true, date: '2025-06-01', timeMinutes: 10 }).expect(200);
    });

    it('rejects playthrough start changes that would move the start after the platinum', async () => {
      await putPlatinum({ achieved: true, date: '2025-06-01', timeMinutes: 10 }).expect(200);

      const moved = await patchFirst({ startDate: '2025-07-01' }).expect(400);
      expect(moved.body).toMatchObject({ code: 'PLATINUM_BEFORE_START' });
      await as(app, alice).post(url('/playthroughs'), { startDate: '2025-07-01' }).expect(400);

      // Allowed: an earlier start, or a later one when another playthrough started before.
      await patchFirst({ startDate: '2025-01-01' }).expect(200);
      await as(app, alice).post(url('/playthroughs'), { startDate: '2026-01-01' }).expect(201);
    });
  });

  describe('independence', () => {
    it('can be achieved while the game is still in progress, and missing when completed', async () => {
      await patchFirst({ status: 'IN_PROGRESS' }).expect(200);
      const inProgress = (
        await putPlatinum({ achieved: true, date: '2025-01-01', timeMinutes: 10 }).expect(200)
      ).body as UserGameDetailsDto;
      expect(inProgress).toMatchObject({ status: 'IN_PROGRESS', platinum: { achieved: true } });

      await putPlatinum({ achieved: false }).expect(200);
      const completed = (
        await patchFirst({ status: 'COMPLETED', completionDate: '2025-02-01' }).expect(200)
      ).body as UserGameDetailsDto;
      expect(completed).toMatchObject({ status: 'COMPLETED', platinum: { achieved: false } });
    });

    it('uses a difficulty list independent from the playthroughs', async () => {
      const hardCampaign = listOf(game, DifficultyKind.Playthrough)[3];
      await patchFirst({ difficultyId: hardCampaign.id }).expect(200);

      const body = (
        await putPlatinum({
          achieved: true,
          date: '2025-01-01',
          timeMinutes: 10,
          difficultyId: platinumEasy().id,
        }).expect(200)
      ).body as UserGameDetailsDto;
      expect(body.playthroughs[0].difficulty?.name).toBe('Difícil');
      expect(body.platinum.difficulty?.name).toBe('Fácil');

      // Lists can't be mixed.
      const wrongList = await putPlatinum({
        achieved: true,
        date: '2025-01-01',
        timeMinutes: 10,
        difficultyId: hardCampaign.id,
      }).expect(400);
      expect(wrongList.body).toMatchObject({ code: 'DIFFICULTY_NOT_FOUND' });
      await patchFirst({ difficultyId: platinumEasy().id }).expect(400);
    });

    it('protects the platinum difficulty in use from deletion', async () => {
      await putPlatinum({
        achieved: true,
        date: '2025-01-01',
        timeMinutes: 10,
        difficultyId: platinumEasy().id,
      }).expect(200);

      const refused = await as(app, alice)
        .delete(url(`/difficulties/${platinumEasy().id}`))
        .expect(409);
      expect(refused.body).toMatchObject({ code: 'DIFFICULTY_IN_USE' });

      // Un-achieving clears every platinum field, freeing the difficulty.
      const cleared = (await putPlatinum({ achieved: false }).expect(200))
        .body as UserGameDetailsDto;
      expect(cleared.platinum).toEqual({
        achieved: false,
        date: null,
        timeMinutes: null,
        difficulty: null,
      });
      await as(app, alice)
        .delete(url(`/difficulties/${platinumEasy().id}`))
        .expect(200);
    });
  });

  it("blocks reading and editing another user's platinum", async () => {
    await as(app, bob).get(url('/platinum')).expect(404);
    await as(app, bob)
      .put(url('/platinum'), { achieved: true, date: '2025-01-01', timeMinutes: 10 })
      .expect(404);
    expect((await as(app, alice).get(url('/platinum')).expect(200)).body).toMatchObject({
      achieved: false,
    });
  });

  it('enforces platinum consistency at the DB level', async () => {
    await expect(
      dataSource.query('UPDATE user_games SET platinum_achieved = true WHERE id = $1', [game.id]),
    ).rejects.toThrow(/CHK_user_games_platinum_fields/);
    await expect(
      dataSource.query('UPDATE user_games SET platinum_date = $2 WHERE id = $1', [
        game.id,
        '2025-01-01',
      ]),
    ).rejects.toThrow(/CHK_user_games_platinum_fields/);
  });
});
