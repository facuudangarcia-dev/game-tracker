import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { DataSource } from 'typeorm';
import { createTestApp } from './create-test-app';

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? 'gt_session';
const credentials = { email: 'player@example.com', password: 'super-secret-1' };

function getSessionCookie(response: request.Response): string {
  const raw = response.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = raw?.find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (!cookie) {
    throw new Error('Session cookie not set');
  }
  return cookie;
}

/** "name=value" part, ready to send back in a Cookie header. */
function cookiePair(setCookie: string): string {
  return setCookie.split(';')[0];
}

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let resetDatabase: () => Promise<void>;

  beforeAll(async () => {
    ({ app, dataSource, resetDatabase } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await app.close();
  });

  const register = (body: object = credentials) =>
    request(app.getHttpServer()).post('/api/auth/register').send(body);
  const login = (body: object = credentials) =>
    request(app.getHttpServer()).post('/api/auth/login').send(body);
  const me = (cookie?: string) => {
    const req = request(app.getHttpServer()).get('/api/auth/me');
    return cookie ? req.set('Cookie', cookiePair(cookie)) : req;
  };

  describe('POST /api/auth/register', () => {
    it('creates the user, logs them in and never returns the password hash', async () => {
      const response = await register({ ...credentials, email: '  Player@Example.COM ' }).expect(
        201,
      );

      expect(response.body).toEqual({
        id: expect.any(String),
        email: 'player@example.com',
        createdAt: expect.any(String),
      });
      const cookie = getSessionCookie(response);
      expect(cookie).toMatch(/HttpOnly/);
      expect(cookie).toMatch(/SameSite=Lax/);
      expect(cookie).toMatch(/Path=\//);
      expect(cookie).toMatch(/Expires=/);

      await me(cookie).expect(200);
    });

    it('stores the password as an Argon2id hash', async () => {
      await register().expect(201);

      const [row] = await dataSource.query<{ password_hash: string }[]>(
        'SELECT password_hash FROM users',
      );
      expect(row.password_hash.startsWith('$argon2id$')).toBe(true);
      expect(row.password_hash).not.toContain(credentials.password);
    });

    it('rejects an email that is already registered, ignoring case', async () => {
      await register().expect(201);

      const response = await register({ ...credentials, email: 'PLAYER@example.com' }).expect(409);
      expect(response.body).toMatchObject({ code: 'EMAIL_ALREADY_REGISTERED' });
    });

    it.each([
      ['an invalid email', { email: 'not-an-email', password: 'super-secret-1' }],
      ['a password shorter than 8', { email: 'a@example.com', password: 'short' }],
      ['a password longer than 128', { email: 'a@example.com', password: 'x'.repeat(129) }],
      ['missing fields', {}],
      ['unknown fields', { ...credentials, isAdmin: true }],
    ])('rejects %s with 400', async (_case, body) => {
      await register(body).expect(400);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await register().expect(201);
    });

    it('logs in with valid credentials (email is case-insensitive)', async () => {
      const response = await login({ ...credentials, email: 'PLAYER@example.com' }).expect(200);

      expect(response.body).toMatchObject({ email: credentials.email });
      await me(getSessionCookie(response)).expect(200);
    });

    it('returns the same 401 for a wrong password and an unknown email', async () => {
      const wrongPassword = await login({ ...credentials, password: 'wrong-password' }).expect(401);
      const unknownEmail = await login({ ...credentials, email: 'nobody@example.com' }).expect(401);

      expect(wrongPassword.body).toEqual(unknownEmail.body);
      expect(wrongPassword.body).toMatchObject({ code: 'INVALID_CREDENTIALS' });
      expect(wrongPassword.headers['set-cookie']).toBeUndefined();
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns 401 UNAUTHENTICATED without a session', async () => {
      const response = await me().expect(401);
      expect(response.body).toMatchObject({ code: 'UNAUTHENTICATED' });
    });

    it('returns 401 for a forged token', async () => {
      await me(`${COOKIE_NAME}=forged-token`).expect(401);
    });

    it('returns 401 for an expired session', async () => {
      const cookie = getSessionCookie(await register().expect(201));
      await dataSource.query(`UPDATE sessions SET expires_at = now() - interval '1 minute'`);

      await me(cookie).expect(401);
      const [{ count }] = await dataSource.query<{ count: string }[]>(
        'SELECT count(*) FROM sessions',
      );
      expect(count).toBe('0');
    });

    it('extends the session (sliding expiration) when it was renewed over a day ago', async () => {
      const cookie = getSessionCookie(await register().expect(201));
      await dataSource.query(`UPDATE sessions SET expires_at = now() + interval '10 days'`);

      const response = await me(cookie).expect(200);

      expect(getSessionCookie(response)).toMatch(/Expires=/);
      const [{ days }] = await dataSource.query<{ days: number }[]>(
        `SELECT extract(day from expires_at - now())::int AS days FROM sessions`,
      );
      expect(days).toBeGreaterThanOrEqual(29);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('invalidates the session on the server, not just the cookie', async () => {
      const cookie = getSessionCookie(await register().expect(201));

      const response = await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Cookie', cookiePair(cookie))
        .expect(204);

      expect(getSessionCookie(response)).toMatch(/Expires=Thu, 01 Jan 1970/);
      // Re-using the old cookie value must fail: the session no longer exists.
      await me(cookie).expect(401);
    });

    it('is idempotent without a session', async () => {
      await request(app.getHttpServer()).post('/api/auth/logout').expect(204);
    });
  });

  it('keeps sessions independent: logging out one device keeps the other', async () => {
    const first = getSessionCookie(await register().expect(201));
    const second = getSessionCookie(await login().expect(200));

    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', cookiePair(first))
      .expect(204);

    await me(first).expect(401);
    await me(second).expect(200);
  });
});
