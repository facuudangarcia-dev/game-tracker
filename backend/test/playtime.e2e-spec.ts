import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import type { DataSource } from 'typeorm';
import type { UserGameDetailsDto } from '../src/library/dto/user-game-response.dto';
import { Platform } from '../src/platforms/platform.entity';
import { createTestApp } from './create-test-app';
import { as, registerUser, type TestUser } from './test-users';

/**
 * Time of a playthrough = its previous time + all its sessions (decision #61).
 * Every session belongs to a playthrough and always counts.
 */
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
  const setPreviousTime = (previousMinutes: unknown, playthroughId = firstId()) =>
    as(app, alice).patch(url(`/playthroughs/${playthroughId}`), { previousMinutes });
  const addSession = (body: object, playthroughId = firstId()) =>
    as(app, alice).post(url(`/playthroughs/${playthroughId}/sessions`), body);
  const detail = async () =>
    (await as(app, alice).get(url()).expect(200)).body as UserGameDetailsDto;

  describe('previous time', () => {
    it('starts at zero and can be set when editing the playthrough', async () => {
      expect(game.playthroughs[0]).toMatchObject({ previousMinutes: 0, minutes: 0 });

      const body = (await setPreviousTime(872).expect(200)).body as UserGameDetailsDto;

      expect(body.playthroughs[0]).toMatchObject({ previousMinutes: 872, minutes: 872 });
      expect(body.totalMinutes).toBe(872);
    });

    it('can be given when creating a playthrough', async () => {
      const body = (
        await as(app, alice).post(url('/playthroughs'), { previousMinutes: 90 }).expect(201)
      ).body as UserGameDetailsDto;

      expect(body.playthroughs[1]).toMatchObject({ previousMinutes: 90, minutes: 90 });
    });

    it.each([-1, 1.5, '90', null, 1_000_001])('rejects previous time %p', async (minutes) => {
      await setPreviousTime(minutes).expect(400);
    });
  });

  describe('sessions', () => {
    it('can be logged on any playthrough and add up to its time', async () => {
      await setPreviousTime(600).expect(200);
      await addSession({ playedAt: yesterday(), durationMinutes: 30, notes: 'Boss fight' }).expect(
        201,
      );
      const body = (await addSession({ playedAt: yesterday(), durationMinutes: 45 }).expect(201))
        .body as UserGameDetailsDto;

      // 600 previous + 30 + 45.
      expect(body.playthroughs[0]).toMatchObject({ previousMinutes: 600, minutes: 675 });
      expect(body.totalMinutes).toBe(675);
      expect(body.sessions).toHaveLength(2);
      expect(body.sessions.find((s) => s.notes === 'Boss fight')).toEqual({
        id: expect.any(String),
        playthroughId: firstId(),
        playthroughNumber: 1,
        playedAt: expect.any(String),
        durationMinutes: 30,
        notes: 'Boss fight',
      });
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

    it('edits and deletes sessions, updating the time', async () => {
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

    it('no longer offers the old time-mode endpoints', async () => {
      await as(app, alice)
        .put(url(`/playthroughs/${firstId()}/manual-time`), { minutes: 1 })
        .expect(404);
      await as(app, alice)
        .put(url(`/playthroughs/${firstId()}/time-mode`), { mode: 'SESSIONS' })
        .expect(404);
    });
  });

  it('sums every playthrough (previous time + sessions) in the UserGame total', async () => {
    await setPreviousTime(100).expect(200);
    const withSecond = (await as(app, alice).post(url('/playthroughs'), {}).expect(201))
      .body as UserGameDetailsDto;
    const secondId = withSecond.playthroughs[1].id;
    await addSession({ playedAt: yesterday(), durationMinutes: 25 }, secondId).expect(201);
    await addSession({ playedAt: yesterday(), durationMinutes: 5 }).expect(201);

    const body = await detail();

    expect(body.playthroughs.map((p) => p.minutes)).toEqual([105, 25]);
    expect(body.totalMinutes).toBe(130);

    // Deleting a playthrough deletes its sessions and its time.
    const afterDelete = (
      await as(app, alice)
        .delete(url(`/playthroughs/${secondId}`))
        .expect(200)
    ).body as UserGameDetailsDto;
    expect(afterDelete.totalMinutes).toBe(105);
    expect(afterDelete.sessions).toHaveLength(1);
  });

  describe('ownership', () => {
    it("blocks time and session operations on another user's game", async () => {
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
      await asBob.patch(url(`/playthroughs/${firstId()}`), { previousMinutes: 1 }).expect(404);

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

  it('enforces the minimum duration and the previous time range at the DB level', async () => {
    await expect(
      dataSource.query(
        `INSERT INTO gaming_sessions (playthrough_id, played_at, duration_minutes) VALUES ($1, now(), 0)`,
        [firstId()],
      ),
    ).rejects.toThrow(/CHK_gaming_sessions_duration_range/);
    await expect(
      dataSource.query(`UPDATE playthroughs SET previous_time_minutes = -1 WHERE id = $1`, [
        firstId(),
      ]),
    ).rejects.toThrow(/CHK_playthroughs_time_not_negative/);
    await expect(
      dataSource.query(`UPDATE playthroughs SET previous_time_minutes = -2000000 WHERE id = $1`, [
        firstId(),
      ]),
    ).rejects.toThrow(/CHK_playthroughs_previous_time_range/);
    // On Steam games the user's change may be negative, never below Steam's time.
    await dataSource.query(
      `UPDATE playthroughs SET steam_minutes = 600, previous_time_minutes = -100 WHERE id = $1`,
      [firstId()],
    );
  });
});
