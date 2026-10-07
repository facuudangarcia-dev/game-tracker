import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { DataSource } from 'typeorm';
import { createTestApp } from './create-test-app';
import type { MockEmailService } from './mock-email-service';
import { registrationBody, TEST_PASSWORD } from './test-users';

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? 'gt_session';
const EMAIL = 'player@example.com';
const credentials = { email: EMAIL, password: TEST_PASSWORD };

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

interface UserRow {
  username: string;
  email_verified: boolean;
  email_verification_code_hash: string | null;
  email_verification_code_expires_at: Date | null;
  email_verification_attempts: number;
  terms_accepted_at: Date | null;
  terms_version: string | null;
  privacy_accepted_at: Date | null;
  privacy_version: string | null;
  password_hash: string;
}

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let emails: MockEmailService;
  let resetDatabase: () => Promise<void>;

  beforeAll(async () => {
    ({ app, dataSource, emails, resetDatabase } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await app.close();
  });

  const post = (url: string, body: object) =>
    request(app.getHttpServer()).post(`/api/auth/${url}`).send(body);
  const register = (overrides: object = {}) => post('register', registrationBody(EMAIL, overrides));
  const login = (body: object = credentials) => post('login', body);
  const verify = (code: string, email = EMAIL) => post('verify-email', { email, code });
  const resend = (email = EMAIL) => post('resend-verification', { email });
  const me = (cookie?: string) => {
    const req = request(app.getHttpServer()).get('/api/auth/me');
    return cookie ? req.set('Cookie', cookiePair(cookie)) : req;
  };
  const userRow = async (email = EMAIL) =>
    (await dataSource.query<UserRow[]>('SELECT * FROM users WHERE email = $1', [email]))[0];
  const sessionCount = async () =>
    Number((await dataSource.query<{ count: string }[]>('SELECT count(*) FROM sessions'))[0].count);
  /** Registers, verifies and logs in; returns the session cookie. */
  const verifiedLogin = async () => {
    await register().expect(201);
    await verify(emails.lastCode(EMAIL)).expect(204);
    return getSessionCookie(await login().expect(200));
  };

  describe('POST /api/auth/register', () => {
    it('creates an unverified user, emails a code and opens no session', async () => {
      const response = await register({
        username: '  Player_One ',
        email: '  Player@Example.COM ',
      }).expect(201);

      expect(response.body).toEqual({
        id: expect.any(String),
        username: 'player_one',
        email: EMAIL,
        emailVerified: false,
        createdAt: expect.any(String),
      });
      expect(response.headers['set-cookie']).toBeUndefined();
      expect(await sessionCount()).toBe(0);

      expect(emails.sent).toHaveLength(1);
      expect(emails.sent[0].to).toBe(EMAIL);
      expect(emails.lastCode(EMAIL)).toMatch(/^\d{6}$/);
    });

    it('stores only a hash of the code, valid for 10 minutes', async () => {
      const before = Date.now();
      await register().expect(201);
      const code = emails.lastCode(EMAIL);

      const row = await userRow();
      expect(row.email_verified).toBe(false);
      expect(row.email_verification_code_hash).toMatch(/^[0-9a-f]{64}$/);
      expect(row.email_verification_code_hash).not.toContain(code);
      expect(JSON.stringify(row)).not.toContain(`"${code}"`);
      const ttl = row.email_verification_code_expires_at!.getTime() - before;
      expect(ttl).toBeGreaterThan(9.9 * 60_000);
      expect(ttl).toBeLessThanOrEqual(10 * 60_000 + 5_000);
    });

    it('stores the password as an Argon2id hash and the acceptance of both documents', async () => {
      await register().expect(201);

      const row = await userRow();
      expect(row.password_hash.startsWith('$argon2id$')).toBe(true);
      expect(row.password_hash).not.toContain(TEST_PASSWORD);
      expect(row.terms_accepted_at).toBeInstanceOf(Date);
      expect(row.privacy_accepted_at).toBeInstanceOf(Date);
      expect(row.terms_version).toBe('2026-10-06');
      expect(row.privacy_version).toBe('2026-10-06');
    });

    it('rejects an email that is already registered, ignoring case', async () => {
      await register().expect(201);

      const response = await register({
        username: 'someone_else',
        email: 'PLAYER@example.com',
      }).expect(409);
      expect(response.body).toMatchObject({ code: 'EMAIL_ALREADY_REGISTERED' });
    });

    it('rejects a username that is already taken, ignoring case', async () => {
      await register({ username: 'Player' }).expect(201);

      const response = await register({ username: 'PLAYER', email: 'other@example.com' }).expect(
        409,
      );
      expect(response.body).toMatchObject({ code: 'USERNAME_TAKEN' });
      expect(emails.sent).toHaveLength(1);
    });

    it('does not create the account when the verification email cannot be sent', async () => {
      emails.failWith = new Error('provider down');

      const response = await register().expect(503);

      expect(response.body).toMatchObject({ code: 'EMAIL_DELIVERY_FAILED' });
      expect(await userRow()).toBeUndefined();
      emails.failWith = null;
      await register().expect(201);
    });

    it.each([
      ['a missing username', { username: undefined }],
      ['a username shorter than 3', { username: 'ab' }],
      ['a username longer than 30', { username: 'a'.repeat(31) }],
      ['a username with invalid characters', { username: 'player-one' }],
      ['a username with spaces inside', { username: 'player one' }],
      ['terms not accepted', { acceptTerms: false }],
      ['privacy not accepted', { acceptPrivacy: false }],
      ['missing acceptances', { acceptTerms: undefined, acceptPrivacy: undefined }],
      ['acceptance sent as a string', { acceptTerms: 'true' }],
      ['an invalid email', { email: 'not-an-email' }],
      ['a password shorter than 8', { password: 'short' }],
      ['a password longer than 128', { password: 'x'.repeat(129) }],
      ['unknown fields', { isAdmin: true }],
    ])('rejects %s with 400 and creates nothing', async (_case, overrides) => {
      await register(overrides).expect(400);

      expect(await userRow()).toBeUndefined();
      expect(emails.sent).toHaveLength(0);
    });
  });

  describe('POST /api/auth/verify-email', () => {
    beforeEach(async () => {
      await register().expect(201);
    });

    it('verifies the email with the right code, without logging in', async () => {
      const response = await verify(emails.lastCode(EMAIL)).expect(204);

      expect(response.headers['set-cookie']).toBeUndefined();
      const row = await userRow();
      expect(row.email_verified).toBe(true);
      expect(row.email_verification_code_hash).toBeNull();
      expect(row.email_verification_code_expires_at).toBeNull();
      expect(await sessionCount()).toBe(0);
    });

    it('accepts the email in any case', async () => {
      await verify(emails.lastCode(EMAIL), ' PLAYER@example.com ').expect(204);
    });

    it('rejects a wrong code', async () => {
      const code = emails.lastCode(EMAIL);
      const wrong = code === '000000' ? '000001' : '000000';

      const response = await verify(wrong).expect(400);

      expect(response.body).toMatchObject({ code: 'INVALID_VERIFICATION_CODE' });
      expect((await userRow()).email_verified).toBe(false);
      // The right code still works after one mistake.
      await verify(code).expect(204);
    });

    it('rejects an expired code and discards it', async () => {
      const code = emails.lastCode(EMAIL);
      await dataSource.query(
        `UPDATE users SET email_verification_code_expires_at = now() - interval '1 second'`,
      );

      const response = await verify(code).expect(400);

      expect(response.body).toMatchObject({ code: 'INVALID_VERIFICATION_CODE' });
      expect((await userRow()).email_verification_code_hash).toBeNull();
    });

    it('rejects a code that was already used', async () => {
      const code = emails.lastCode(EMAIL);
      await verify(code).expect(204);

      const response = await verify(code).expect(400);
      expect(response.body).toMatchObject({ code: 'INVALID_VERIFICATION_CODE' });
    });

    it('invalidates the code after 5 wrong attempts', async () => {
      const code = emails.lastCode(EMAIL);
      const wrong = code === '000000' ? '000001' : '000000';
      for (let attempt = 0; attempt < 5; attempt++) {
        await verify(wrong).expect(400);
      }

      await verify(code).expect(400);
      expect((await userRow()).email_verified).toBe(false);
    });

    it('gives the same answer for an unknown email (no enumeration)', async () => {
      const unknown = await verify('123456', 'nobody@example.com').expect(400);
      const wrong = await verify(emails.lastCode(EMAIL) === '123456' ? '654321' : '123456').expect(
        400,
      );

      expect(unknown.body).toEqual(wrong.body);
    });

    it.each([['12345'], ['1234567'], ['abcdef'], ['']])(
      'rejects the malformed code %p with 400',
      async (code) => {
        await verify(code).expect(400);
      },
    );
  });

  describe('POST /api/auth/resend-verification', () => {
    beforeEach(async () => {
      await register().expect(201);
    });

    /** Moves the last send out of the cooldown window. */
    const skipCooldown = () =>
      dataSource.query(
        `UPDATE users SET email_verification_sent_at = now() - interval '61 seconds'`,
      );

    it('sends a new code and invalidates the previous one', async () => {
      const first = emails.lastCode(EMAIL);
      await skipCooldown();

      await resend().expect(202);

      expect(emails.sent).toHaveLength(2);
      const second = emails.lastCode(EMAIL);
      if (first !== second) {
        await verify(first).expect(400);
      }
      await verify(second).expect(204);
    });

    it('applies a cooldown between sends', async () => {
      await resend().expect(202);
      expect(emails.sent).toHaveLength(1);

      await skipCooldown();
      await resend().expect(202);
      await resend().expect(202);
      expect(emails.sent).toHaveLength(2);
    });

    it('answers the same for unknown and already verified accounts, sending nothing', async () => {
      await verify(emails.lastCode(EMAIL)).expect(204);
      await skipCooldown();

      const verified = await resend().expect(202);
      const unknown = await resend('nobody@example.com').expect(202);

      expect(verified.body).toEqual(unknown.body);
      expect(emails.sent).toHaveLength(1);
    });

    it('lets the user retry right away when the delivery failed', async () => {
      await skipCooldown();
      emails.failWith = new Error('provider down');
      await resend().expect(202);
      // The failure is handled in the background.
      await new Promise((resolve) => setTimeout(resolve, 50));

      emails.failWith = null;
      await resend().expect(202);
      expect(emails.sent).toHaveLength(2);
    });
  });

  describe('POST /api/auth/login', () => {
    it('refuses an unverified account: no session, no cookie', async () => {
      await register().expect(201);

      const response = await login().expect(403);

      expect(response.body).toMatchObject({ code: 'EMAIL_NOT_VERIFIED' });
      expect(response.headers['set-cookie']).toBeUndefined();
      expect(await sessionCount()).toBe(0);
    });

    it('checks the password before revealing that the email is unverified', async () => {
      await register().expect(201);

      const response = await login({ ...credentials, password: 'wrong-password' }).expect(401);
      expect(response.body).toMatchObject({ code: 'INVALID_CREDENTIALS' });
    });

    it('logs in a verified user (email is case-insensitive)', async () => {
      await register().expect(201);
      await verify(emails.lastCode(EMAIL)).expect(204);

      const response = await login({ ...credentials, email: 'PLAYER@example.com' }).expect(200);

      expect(response.body).toMatchObject({
        email: EMAIL,
        username: 'player',
        emailVerified: true,
      });
      const cookie = getSessionCookie(response);
      expect(cookie).toMatch(/HttpOnly/);
      expect(cookie).toMatch(/SameSite=Lax/);
      expect(cookie).toMatch(/Path=\//);
      expect(cookie).toMatch(/Expires=/);
      await me(cookie).expect(200);
    });

    it('returns the same 401 for a wrong password and an unknown email', async () => {
      await verifiedLogin();

      const wrongPassword = await login({ ...credentials, password: 'wrong-password' }).expect(401);
      const unknownEmail = await login({ ...credentials, email: 'nobody@example.com' }).expect(401);

      expect(wrongPassword.body).toEqual(unknownEmail.body);
      expect(wrongPassword.body).toMatchObject({ code: 'INVALID_CREDENTIALS' });
      expect(wrongPassword.headers['set-cookie']).toBeUndefined();
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns the user with the username', async () => {
      const response = await me(await verifiedLogin()).expect(200);

      expect(response.body).toEqual({
        id: expect.any(String),
        username: 'player',
        email: EMAIL,
        emailVerified: true,
        createdAt: expect.any(String),
      });
    });

    it('returns 401 UNAUTHENTICATED without a session', async () => {
      const response = await me().expect(401);
      expect(response.body).toMatchObject({ code: 'UNAUTHENTICATED' });
    });

    it('returns 401 for a forged token', async () => {
      await me(`${COOKIE_NAME}=forged-token`).expect(401);
    });

    it('returns 401 for an expired session', async () => {
      const cookie = await verifiedLogin();
      await dataSource.query(`UPDATE sessions SET expires_at = now() - interval '1 minute'`);

      await me(cookie).expect(401);
      expect(await sessionCount()).toBe(0);
    });

    it('extends the session (sliding expiration) when it was renewed over a day ago', async () => {
      const cookie = await verifiedLogin();
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
      const cookie = await verifiedLogin();

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
    const first = await verifiedLogin();
    const second = getSessionCookie(await login().expect(200));

    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', cookiePair(first))
      .expect(204);

    await me(first).expect(401);
    await me(second).expect(200);
  });
});

describe('Auth rate limiting (e2e)', () => {
  let app: INestApplication<App>;
  let resetDatabase: () => Promise<void>;

  beforeAll(async () => {
    ({ app, resetDatabase } = await createTestApp({ authRateLimit: 3 }));
    await resetDatabase();
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([
    ['resend-verification', { email: EMAIL }],
    ['verify-email', { email: EMAIL, code: '123456' }],
    ['login', credentials],
    ['register', registrationBody('x', { email: 'not-an-email' })],
  ])('limits POST /api/auth/%s per IP', async (route, body) => {
    for (let i = 0; i < 3; i++) {
      const response = await request(app.getHttpServer()).post(`/api/auth/${route}`).send(body);
      expect(response.status).not.toBe(429);
    }

    await request(app.getHttpServer()).post(`/api/auth/${route}`).send(body).expect(429);
  });
});
