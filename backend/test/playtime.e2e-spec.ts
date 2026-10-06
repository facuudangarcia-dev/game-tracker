import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import type { DataSource } from 'typeorm';
import type { UserGameDetailsDto } from '../src/library/dto/user-game-response.dto';
import { Platform } from '../src/platforms/platform.entity';
import { createTestApp } from './create-test-app';
import { as, registerUser, type TestUser } from './test-users';

describe('Sessions and time tracking (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let resetDatabase: () => Promise<void>;
  let alice: TestUser;
  let bob: TestUser;
  let game: UserGameDetailsDto;

  const yesterday = () => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const inTwoHours = () => new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

  beforeAll(async () => {
    ({ app, dataSource, resetDatabase } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase();
    alice = await registerUser(app, 'alice@example.com');
    bob = await registerUser(app, 'bob@example.com');
    const pc = await dataSource.getRepository(Platform).findOneByOrFail({ slug: 'pc' });
    game = (
      await as(app, alice)
        .post('/api/library', { manualGame: { name: 'Homebrew' }, platformId: pc.id })
        .expect(201)
    ).body as UserGameDetailsDto;
  });

  afterAll(async () => {
    await app.close();
  });

  const url = (path = '') => `/api/library/${game.id}${path}`;
  const firstId = () => game.playthroughs[0].id;
  const setManualTime = (minutes: unknown, playthroughId = firstId()) =>
    as(app, alice).put(url(`/playthroughs/${playthroughId}/manual-time`), { minutes });
  const changeMode = (body: object, playthroughId = firstId()) =>
    as(app, alice).put(url(`/playthroughs/${playthroughId}/time-mode`), body);
  const addSession = (body: object, playthroughId = firstId()) =>
    as(app, alice).post(url(`/playthroughs/${playthroughId}/sessions`), body);
  const detail = async () =>
    (await as(app, alice).get(url()).expect(200)).body as UserGameDetailsDto;

  describe('MANUAL mode', () => {
    it('records the total time of a playthrough in integer minutes', async () => {
      const body = (await setManualTime(872).expect(200)).body as UserGameDetailsDto;

      expect(body.playthroughs[0]).toMatchObject({ timeMode: 'MANUAL', minutes: 872 });
      expect(body.totalMinutes).toBe(872);
    });

    it.each([-1, 1.5, '90', null, 1_000_001])('rejects manual time %p', async (minutes) => {
      await setManualTime(minutes).expect(400);
    });

    it('does not accept sessions', async () => {
      const response = await addSession({ playedAt: yesterday(), durationMinutes: 30 }).expect(409);
      expect(response.body).toMatchObject({ code: 'SESSIONS_REQUIRE_SESSION_MODE' });
    });
  });

  describe('SESSIONS mode', () => {
    beforeEach(async () => {
      await changeMode({ mode: 'SESSIONS' }).expect(200);
    });

    it('sums the sessions and refuses direct manual time edits', async () => {
      await addSession({ playedAt: yesterday(), durationMinutes: 30, notes: 'Boss fight' }).expect(
        201,
      );
      const body = (await addSession({ playedAt: yesterday(), durationMinutes: 45 }).expect(201))
        .body as UserGameDetailsDto;

      expect(body.playthroughs[0]).toMatchObject({ timeMode: 'SESSIONS', minutes: 75 });
      expect(body.totalMinutes).toBe(75);
      expect(body.sessions).toHaveLength(2);
      expect(body.sessions.find((s) => s.notes === 'Boss fight')).toMatchObject({
        playthroughNumber: 1,
        durationMinutes: 30,
        countsTowardTime: true,
      });

      const refused = await setManualTime(10).expect(409);
      expect(refused.body).toMatchObject({ code: 'MANUAL_TIME_REQUIRES_MANUAL_MODE' });
    });

    it.each([
      ['a zero duration', { playedAt: new Date().toISOString(), durationMinutes: 0 }],
      ['a decimal duration', { playedAt: new Date().toISOString(), durationMinutes: 1.5 }],
      ['a missing date', { durationMinutes: 10 }],
      ['an invalid date', { playedAt: 'yesterday', durationMinutes: 10 }],
      [
        'a too long note',
        { playedAt: new Date().toISOString(), durationMinutes: 10, notes: 'x'.repeat(5001) },
      ],
    ])('rejects %s', async (_case, body) => {
      await addSession(body).expect(400);
    });

    it('rejects future sessions', async () => {
      const response = await addSession({ playedAt: inTwoHours(), durationMinutes: 10 }).expect(
        400,
      );
      expect(response.body).toMatchObject({ code: 'DATE_IN_FUTURE' });
    });

    it('accepts a 1-minute session played right now', async () => {
      await addSession({ playedAt: new Date().toISOString(), durationMinutes: 1 }).expect(201);
    });

    it('edits and deletes sessions', async () => {
      const created = (await addSession({ playedAt: yesterday(), durationMinutes: 30 }).expect(201))
        .body as UserGameDetailsDto;
      const sessionId = created.sessions[0].id;

      const edited = (
        await as(app, alice)
          .patch(url(`/sessions/${sessionId}`), { durationMinutes: 90, notes: 'Longer' })
          .expect(200)
      ).body as UserGameDetailsDto;
      expect(edited.totalMinutes).toBe(90);
      expect(edited.sessions[0]).toMatchObject({ durationMinutes: 90, notes: 'Longer' });
      await as(app, alice)
        .patch(url(`/sessions/${sessionId}`), { playedAt: inTwoHours() })
        .expect(400);

      const deleted = (
        await as(app, alice)
          .delete(url(`/sessions/${sessionId}`))
          .expect(200)
      ).body as UserGameDetailsDto;
      expect(deleted.sessions).toEqual([]);
      expect(deleted.totalMinutes).toBe(0);
    });
  });

  describe('switching modes never loses time', () => {
    it('MANUAL → SESSIONS turns the manual time into an initial session when asked', async () => {
      await setManualTime(600).expect(200);
      const playedAt = yesterday();

      const body = (
        await changeMode({ mode: 'SESSIONS', initialSession: { playedAt } }).expect(200)
      ).body as UserGameDetailsDto;

      expect(body.playthroughs[0]).toMatchObject({ timeMode: 'SESSIONS', minutes: 600 });
      expect(body.sessions).toEqual([
        expect.objectContaining({ durationMinutes: 600, playedAt, countsTowardTime: true }),
      ]);
    });

    it('MANUAL → SESSIONS without an initial session keeps the manual value stored', async () => {
      await setManualTime(600).expect(200);

      const body = (await changeMode({ mode: 'SESSIONS' }).expect(200)).body as UserGameDetailsDto;

      expect(body.playthroughs[0]).toMatchObject({ minutes: 0, manualTimeMinutes: 600 });
      expect(body.sessions).toEqual([]);
    });

    it('SESSIONS → MANUAL uses the sessions total and keeps the sessions (not counted)', async () => {
      await changeMode({ mode: 'SESSIONS' }).expect(200);
      await addSession({ playedAt: yesterday(), durationMinutes: 50 }).expect(201);
      await addSession({ playedAt: yesterday(), durationMinutes: 70 }).expect(201);

      const manual = (await changeMode({ mode: 'MANUAL' }).expect(200)).body as UserGameDetailsDto;

      expect(manual.playthroughs[0]).toMatchObject({
        timeMode: 'MANUAL',
        manualTimeMinutes: 120,
        minutes: 120,
      });
      expect(manual.sessions).toHaveLength(2);
      expect(manual.sessions.every((s) => !s.countsTowardTime)).toBe(true);

      // Editing the manual time does not mix with the kept sessions.
      const edited = (await setManualTime(200).expect(200)).body as UserGameDetailsDto;
      expect(edited.totalMinutes).toBe(200);

      // Back to SESSIONS: only the sessions count again.
      const back = (await changeMode({ mode: 'SESSIONS' }).expect(200)).body as UserGameDetailsDto;
      expect(back.totalMinutes).toBe(120);
    });

    it('treats switching to the current mode as a no-op', async () => {
      await setManualTime(30).expect(200);
      const body = (await changeMode({ mode: 'MANUAL' }).expect(200)).body as UserGameDetailsDto;
      expect(body.playthroughs[0].minutes).toBe(30);
    });

    it('rejects an unknown mode and a future initial session', async () => {
      await changeMode({ mode: 'MIXED' }).expect(400);
      await setManualTime(30).expect(200);
      await changeMode({ mode: 'SESSIONS', initialSession: { playedAt: inTwoHours() } }).expect(
        400,
      );
      expect((await detail()).playthroughs[0].timeMode).toBe('MANUAL');
    });
  });

  it('sums the time of every playthrough in the UserGame total', async () => {
    await setManualTime(100).expect(200);
    const withSecond = (await as(app, alice).post(url('/playthroughs'), {}).expect(201))
      .body as UserGameDetailsDto;
    const secondId = withSecond.playthroughs[1].id;
    await changeMode({ mode: 'SESSIONS' }, secondId).expect(200);
    await addSession({ playedAt: yesterday(), durationMinutes: 25 }, secondId).expect(201);

    const body = await detail();

    expect(body.playthroughs.map((p) => p.minutes)).toEqual([100, 25]);
    expect(body.totalMinutes).toBe(125);

    // Deleting a playthrough deletes its sessions and its time.
    const afterDelete = (
      await as(app, alice)
        .delete(url(`/playthroughs/${secondId}`))
        .expect(200)
    ).body as UserGameDetailsDto;
    expect(afterDelete.totalMinutes).toBe(100);
    expect(afterDelete.sessions).toEqual([]);
  });

  describe('ownership', () => {
    it("blocks time and session operations on another user's game", async () => {
      await changeMode({ mode: 'SESSIONS' }).expect(200);
      const created = (await addSession({ playedAt: yesterday(), durationMinutes: 10 }).expect(201))
        .body as UserGameDetailsDto;
      const sessionId = created.sessions[0].id;
      const asBob = as(app, bob);

      await asBob.get(url('/sessions')).expect(404);
      await asBob
        .post(url(`/playthroughs/${firstId()}/sessions`), {
          playedAt: yesterday(),
          durationMinutes: 10,
        })
        .expect(404);
      await asBob.patch(url(`/sessions/${sessionId}`), { durationMinutes: 1 }).expect(404);
      await asBob.delete(url(`/sessions/${sessionId}`)).expect(404);
      await asBob.put(url(`/playthroughs/${firstId()}/manual-time`), { minutes: 1 }).expect(404);
      await asBob.put(url(`/playthroughs/${firstId()}/time-mode`), { mode: 'MANUAL' }).expect(404);

      // Nor through Bob's own game.
      const pc = await dataSource.getRepository(Platform).findOneByOrFail({ slug: 'pc' });
      const bobsGame = (
        await asBob
          .post('/api/library', { manualGame: { name: 'Bob' }, platformId: pc.id })
          .expect(201)
      ).body as UserGameDetailsDto;
      const viaOwn = await asBob
        .delete(`/api/library/${bobsGame.id}/sessions/${sessionId}`)
        .expect(404);
      expect(viaOwn.body).toMatchObject({ code: 'SESSION_NOT_FOUND' });
      expect((await detail()).sessions).toHaveLength(1);
    });
  });

  it('enforces the minimum duration at the DB level', async () => {
    await expect(
      dataSource.query(
        `INSERT INTO gaming_sessions (playthrough_id, played_at, duration_minutes) VALUES ($1, now(), 0)`,
        [firstId()],
      ),
    ).rejects.toThrow(/CHK_gaming_sessions_duration_range/);
  });
});
