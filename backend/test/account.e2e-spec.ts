import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { DataSource } from 'typeorm';
import { ASSET_STORAGE, type AssetStorage } from '../src/assets/asset-storage';
import { Game } from '../src/games/game.entity';
import { Platform } from '../src/platforms/platform.entity';
import { User } from '../src/users/user.entity';
import { createTestApp } from './create-test-app';
import { as, registerUser, TEST_PASSWORD, type TestUser, usernameFor } from './test-users';

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('shared png payload'),
]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('own jpeg')]);

describe('Account deletion (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let resetDatabase: () => Promise<void>;
  let storage: AssetStorage;
  let alice: TestUser;
  let bob: TestUser;

  beforeAll(async () => {
    ({ app, dataSource, resetDatabase } = await createTestApp());
    storage = app.get(ASSET_STORAGE);
  });

  beforeEach(async () => {
    await resetDatabase();
    alice = await registerUser(app, 'alice@example.com');
    bob = await registerUser(app, 'bob@example.com');
  });

  afterAll(async () => {
    await app.close();
  });

  const upload = (user: TestUser, data: Buffer, type: string) =>
    request(app.getHttpServer())
      .put('/api/profile/avatar/image')
      .set('Cookie', user.cookie)
      .set('Content-Type', type)
      .send(data)
      .expect(200);
  const avatarKey = async (user: TestUser) =>
    (await dataSource.getRepository(User).findOneByOrFail({ id: user.id })).avatarAssetKey!;
  const deleteAccount = (user: TestUser, password: string) =>
    as(app, user).post('/api/auth/delete-account', { password });

  it('needs the right password and a session', async () => {
    const wrong = await deleteAccount(alice, 'not-my-password').expect(400);
    expect(wrong.body).toMatchObject({ code: 'WRONG_PASSWORD' });
    await request(app.getHttpServer())
      .post('/api/auth/delete-account')
      .send({ password: TEST_PASSWORD })
      .expect(401);
    await as(app, alice).get('/api/auth/me').expect(200);
  });

  it('deletes the account with all its data and images nobody else uses', async () => {
    const pc = await dataSource.getRepository(Platform).findOneByOrFail({ slug: 'pc' });
    await as(app, alice)
      .post('/api/library', { manualGame: { name: 'My own game' }, platformId: pc.id })
      .expect(201);
    await upload(alice, JPEG, 'image/jpeg');
    const ownImage = await avatarKey(alice);

    const response = await deleteAccount(alice, TEST_PASSWORD).expect(204);
    expect(String(response.headers['set-cookie'])).toMatch(/Expires=Thu, 01 Jan 1970/);

    await as(app, alice).get('/api/auth/me').expect(401);
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: usernameFor('alice@example.com'), password: TEST_PASSWORD })
      .expect(401);
    expect(await dataSource.getRepository(User).countBy({ id: alice.id })).toBe(0);
    expect(await dataSource.getRepository(Game).countBy({ createdByUserId: alice.id })).toBe(0);
    expect(await storage.get(ownImage)).toBeNull();
    // Bob is untouched.
    await as(app, bob).get('/api/auth/me').expect(200);
  });

  it('keeps an image another user also uses', async () => {
    await upload(alice, PNG, 'image/png');
    await upload(bob, PNG, 'image/png');
    const shared = await avatarKey(alice);
    expect(await avatarKey(bob)).toBe(shared);

    await deleteAccount(alice, TEST_PASSWORD).expect(204);
    expect(await storage.get(shared)).not.toBeNull();
  });
});
