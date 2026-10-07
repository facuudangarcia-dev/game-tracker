import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { DataSource } from 'typeorm';
import { DifficultyKind } from '../src/library/difficulty.entity';
import type { UserGameDetailsDto } from '../src/library/dto/user-game-response.dto';
import { Platform } from '../src/platforms/platform.entity';
import { SessionsService } from '../src/auth/sessions.service';
import { User } from '../src/users/user.entity';
import { createTestApp } from './create-test-app';
import { as, registerUser, registrationBody, type TestUser } from './test-users';

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? 'gt_session';

type Method = 'get' | 'post' | 'patch' | 'put' | 'delete';
type Route = [Method, string, object?];

/**
 * V1 security review: every non-public endpoint requires a session, and no
 * user can read or modify another user's data through any library route.
 */
describe('Security review (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let resetDatabase: () => Promise<void>;
  let alice: TestUser;
  let bob: TestUser;
  let game: UserGameDetailsDto;
  let routes: Route[];

  beforeAll(async () => {
    ({ app, dataSource, resetDatabase } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase();
    alice = await registerUser(app, 'alice@example.com');
    bob = await registerUser(app, 'bob@example.com');
    const pc = await dataSource.getRepository(Platform).findOneByOrFail({ slug: 'pc' });
    const asAlice = as(app, alice);

    const created = (
      await asAlice
        .post('/api/library', { manualGame: { name: 'Secret' }, platformId: pc.id })
        .expect(201)
    ).body as UserGameDetailsDto;
    const base = `/api/library/${created.id}`;
    const withSecond = (await asAlice.post(`${base}/playthroughs`, { name: 'Two' }).expect(201))
      .body as UserGameDetailsDto;
    const second = withSecond.playthroughs[1];
    await asAlice
      .put(`${base}/playthroughs/${second.id}/time-mode`, { mode: 'SESSIONS' })
      .expect(200);
    await asAlice
      .post(`${base}/playthroughs/${second.id}/sessions`, {
        playedAt: new Date(Date.now() - 3600_000).toISOString(),
        durationMinutes: 30,
        notes: 'private',
      })
      .expect(201);
    await asAlice.patch(base, { rating: 80, notes: 'private note' }).expect(200);
    await asAlice
      .put(`${base}/platinum`, { achieved: true, date: '2025-01-01', timeMinutes: 60 })
      .expect(200);
    game = (await asAlice.get(base).expect(200)).body as UserGameDetailsDto;

    const playthroughId = game.playthroughs[1].id;
    const sessionId = game.sessions[0].id;
    const difficultyId = game.difficulties.find((d) => d.kind === DifficultyKind.Playthrough)!.id;
    const kindIds = game.difficulties
      .filter((d) => d.kind === DifficultyKind.Playthrough)
      .map((d) => d.id);

    // Every endpoint of a UserGame and its nested resources.
    routes = [
      ['get', base],
      ['patch', base, { rating: 10 }],
      ['delete', base],
      ['get', `${base}/playthroughs`],
      ['post', `${base}/playthroughs`, {}],
      ['patch', `${base}/playthroughs/${playthroughId}`, { name: 'x' }],
      ['delete', `${base}/playthroughs/${playthroughId}`],
      ['put', `${base}/playthroughs/${game.playthroughs[0].id}/manual-time`, { minutes: 1 }],
      ['put', `${base}/playthroughs/${playthroughId}/time-mode`, { mode: 'MANUAL' }],
      [
        'post',
        `${base}/playthroughs/${playthroughId}/sessions`,
        { playedAt: new Date().toISOString(), durationMinutes: 5 },
      ],
      ['get', `${base}/sessions`],
      ['patch', `${base}/sessions/${sessionId}`, { durationMinutes: 1 }],
      ['delete', `${base}/sessions/${sessionId}`],
      ['get', `${base}/platinum`],
      ['put', `${base}/platinum`, { achieved: false }],
      ['get', `${base}/difficulties`],
      ['post', `${base}/difficulties`, { kind: 'PLAYTHROUGH', name: 'x' }],
      ['patch', `${base}/difficulties/${difficultyId}`, { name: 'x' }],
      ['delete', `${base}/difficulties/${difficultyId}`],
      ['put', `${base}/difficulties/order`, { kind: 'PLAYTHROUGH', ids: kindIds }],
    ];
  });

  afterAll(async () => {
    await app.close();
  });

  const send = (method: Method, url: string, body?: object, cookie?: string) => {
    const req = request(app.getHttpServer())[method](url);
    if (cookie) req.set('Cookie', cookie);
    return body ? req.send(body) : req;
  };

  it('requires a session on every non-public endpoint', async () => {
    const global: Route[] = [
      ['get', '/api/auth/me'],
      ['get', '/api/platforms'],
      ['get', '/api/genres'],
      ['get', '/api/catalog/search?q=zelda'],
      ['get', '/api/catalog/igdb/images/co1wyy'],
      ['get', '/api/library'],
      ['post', '/api/library', {}],
    ];
    for (const [method, url, body] of [...global, ...routes]) {
      const response = await send(method, url, body);
      expect({ method, url, status: response.status }).toEqual({ method, url, status: 401 });
    }
  });

  it('blocks an unverified user on every authenticated endpoint, even with a session', async () => {
    // Unverified users can't log in; the session is forged server-side to simulate a
    // manipulated client or a session that predates the verification requirement.
    const server = app.getHttpServer();
    await request(server)
      .post('/api/auth/register')
      .send(registrationBody('mallory@example.com'))
      .expect(201);
    const mallory = await dataSource
      .getRepository(User)
      .findOneByOrFail({ email: 'mallory@example.com' });
    const global: Route[] = [
      ['get', '/api/auth/me'],
      ['get', '/api/platforms'],
      ['get', '/api/genres'],
      ['get', '/api/catalog/search?q=zelda'],
      ['get', '/api/catalog/games/igdb/1942'],
      ['get', '/api/catalog/igdb/images/co1wyy'],
      ['get', '/api/library'],
      ['post', '/api/library', { manualGame: { name: 'x' }, platformId: game.platform.id }],
    ];

    for (const [method, url, body] of [...global, ...routes]) {
      const { token } = await app.get(SessionsService).create(mallory.id);
      const response = await send(method, url, body, `${COOKIE_NAME}=${token}`);
      expect({
        method,
        url,
        status: response.status,
        code: (response.body as { code?: string }).code,
      }).toEqual({
        method,
        url,
        status: 403,
        code: 'EMAIL_NOT_VERIFIED',
      });
    }
    // Each blocked session is also revoked.
    const [{ count }] = await dataSource.query<{ count: string }[]>(
      'SELECT count(*) FROM sessions WHERE user_id = $1',
      [mallory.id],
    );
    expect(count).toBe('0');
  });

  it('keeps the email verification flow public', async () => {
    await send('post', '/api/auth/verify-email', { email: 'a@example.com', code: '123456' }).expect(
      400,
    );
    await send('post', '/api/auth/resend-verification', { email: 'a@example.com' }).expect(202);
  });

  it('keeps only the intended endpoints public', async () => {
    await send('get', '/api/health').expect(200);
    await send('post', '/api/auth/logout').expect(204);
    await send('get', '/api/assets/covers/missing.jpg').expect(404);
  });

  it("never lets a user read or change another user's game or its nested data", async () => {
    for (const [method, url, body] of routes) {
      const response = await send(method, url, body, bob.cookie);
      expect({ method, url, status: response.status }).toEqual({ method, url, status: 404 });
    }

    // Alice's data is untouched.
    const after = (await as(app, alice).get(`/api/library/${game.id}`).expect(200))
      .body as UserGameDetailsDto;
    expect(after).toEqual(game);
    // Bob's library and searches never show it.
    await as(app, bob).get('/api/library').expect(200, []);
    const search = await as(app, bob).get('/api/catalog/search?q=secret').expect(200);
    expect((search.body as { results: unknown[] }).results).toEqual([]);
  });
});
