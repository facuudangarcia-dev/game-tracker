import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import type { DataSource } from 'typeorm';
import { PRIVACY_VERSION, TERMS_VERSION } from '../src/auth/auth.constants';
import type { UserResponseDto } from '../src/users/user-response.dto';
import { createTestApp } from './create-test-app';
import { as, registerUser, type TestUser } from './test-users';

describe('Accepting updated legal documents (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let resetDatabase: () => Promise<void>;
  let alice: TestUser;

  beforeAll(async () => {
    ({ app, dataSource, resetDatabase } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase();
    alice = await registerUser(app, 'alice@example.com');
  });

  afterAll(async () => {
    await app.close();
  });

  const me = async () =>
    (await as(app, alice).get('/api/auth/me').expect(200)).body as UserResponseDto;

  it('new accounts already accepted the current versions', async () => {
    expect((await me()).legalAcceptanceRequired).toBe(false);
    await as(app, alice).get('/api/library').expect(200);
  });

  it('blocks the app until the new versions are accepted', async () => {
    await dataSource.query(`UPDATE users SET terms_version = '2026-10-06' WHERE id = $1`, [
      alice.id,
    ]);
    expect((await me()).legalAcceptanceRequired).toBe(true);
    const blocked = await as(app, alice).get('/api/library').expect(403);
    expect(blocked.body).toMatchObject({ code: 'LEGAL_ACCEPTANCE_REQUIRED' });
    await as(app, alice).get('/api/friends').expect(403);

    await as(app, alice).post('/api/auth/accept-legal', { acceptTerms: true }).expect(400);
    const accepted = (
      await as(app, alice)
        .post('/api/auth/accept-legal', { acceptTerms: true, acceptPrivacy: true })
        .expect(200)
    ).body as UserResponseDto;
    expect(accepted.legalAcceptanceRequired).toBe(false);
    await as(app, alice).get('/api/library').expect(200);
    const [row] = await dataSource.query<{ terms_version: string; privacy_version: string }[]>(
      'SELECT terms_version, privacy_version FROM users WHERE id = $1',
      [alice.id],
    );
    expect(row).toEqual({ terms_version: TERMS_VERSION, privacy_version: PRIVACY_VERSION });
  });

  it('still lets the user delete the account', async () => {
    await dataSource.query(`UPDATE users SET privacy_version = '2026-10-06' WHERE id = $1`, [
      alice.id,
    ]);
    await as(app, alice)
      .post('/api/auth/delete-account', { password: 'super-secret-1' })
      .expect(204);
  });
});
