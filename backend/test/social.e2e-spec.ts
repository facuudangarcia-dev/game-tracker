import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { DataSource } from 'typeorm';
import type { UserGameDetailsDto } from '../src/library/dto/user-game-response.dto';
import { Platform } from '../src/platforms/platform.entity';
import type { PlayerProfileDto } from '../src/players/players.controller';
import type { FriendsDto, UserSearchResultDto } from '../src/social/social.service';
import type { PublicUserDto, UserResponseDto } from '../src/users/user-response.dto';
import { EmailService } from '../src/email/email.service';
import { createTestApp } from './create-test-app';
import type { MockEmailService } from './mock-email-service';
import { as, registerUser, type TestUser } from './test-users';

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('social png'),
]);

describe('Friends, blocks and visibility (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let resetDatabase: () => Promise<void>;
  let alice: TestUser;
  let bob: TestUser;
  let carol: TestUser;

  beforeAll(async () => {
    ({ app, dataSource, resetDatabase } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase();
    alice = await registerUser(app, 'alice@example.com');
    bob = await registerUser(app, 'bobby@example.com');
    carol = await registerUser(app, 'carol@example.com');
  });

  afterAll(async () => {
    await app.close();
  });

  const search = async (user: TestUser, q: string) =>
    (
      await as(app, user)
        .get(`/api/users/search?q=${encodeURIComponent(q)}`)
        .expect(200)
    ).body as UserSearchResultDto[];
  const friends = async (user: TestUser) =>
    (await as(app, user).get('/api/friends').expect(200)).body as FriendsDto;
  const names = (list: PublicUserDto[]) => list.map((u) => u.username);
  const sendRequest = (from: TestUser, to: TestUser) =>
    as(app, from).post('/api/friends/requests', { username: to.username });
  const befriend = async (a: TestUser, b: TestUser) => {
    await sendRequest(a, b).expect(200);
    await as(app, b).post(`/api/friends/requests/${a.username}/accept`).expect(204);
  };

  describe('search', () => {
    it('finds users by part of the username, never showing emails', async () => {
      expect(await search(alice, 'bo')).toEqual([]);
      const found = await search(alice, 'OBB');
      expect(found).toEqual([{ username: 'bobby', avatar: null, relation: 'NONE' }]);
      expect(JSON.stringify(found)).not.toContain('@');
      // Never yourself.
      expect(names(await search(alice, 'alice'))).toEqual([]);
    });

    it('shows how each user relates to me', async () => {
      await sendRequest(alice, bob).expect(200);
      await sendRequest(carol, alice).expect(200);
      expect(await search(alice, 'bobby')).toMatchObject([{ relation: 'REQUEST_SENT' }]);
      expect(await search(alice, 'carol')).toMatchObject([{ relation: 'REQUEST_RECEIVED' }]);
      await as(app, alice).post('/api/friends/requests/bobby/accept').expect(404);
      await as(app, bob).post('/api/friends/requests/alice/accept').expect(204);
      expect(await search(alice, 'bobby')).toMatchObject([{ relation: 'FRIEND' }]);
    });
  });

  describe('requests', () => {
    it('are mutual: a request becomes a friendship once accepted', async () => {
      expect((await sendRequest(alice, bob).expect(200)).body).toEqual({
        relation: 'REQUEST_SENT',
      });
      expect(names((await friends(alice)).outgoing)).toEqual(['bobby']);
      expect(names((await friends(bob)).incoming)).toEqual(['alice']);

      await as(app, bob).post('/api/friends/requests/ALICE/accept').expect(204);
      expect(await friends(alice)).toMatchObject({ incoming: [], outgoing: [] });
      expect(names((await friends(alice)).friends)).toEqual(['bobby']);
      expect(names((await friends(bob)).friends)).toEqual(['alice']);
    });

    it('accepts automatically when both send one', async () => {
      await sendRequest(carol, alice).expect(200);
      expect((await sendRequest(alice, carol).expect(200)).body).toEqual({ relation: 'FRIEND' });
      expect(names((await friends(carol)).friends)).toEqual(['alice']);
    });

    it('can be declined, cancelled, and friends removed', async () => {
      await sendRequest(alice, bob).expect(200);
      await as(app, bob).delete('/api/friends/requests/alice').expect(204);
      expect(await friends(alice)).toEqual({ friends: [], incoming: [], outgoing: [] });

      await sendRequest(alice, bob).expect(200);
      await as(app, alice).delete('/api/friends/requests/bobby').expect(204);
      expect((await friends(bob)).incoming).toEqual([]);

      await befriend(alice, bob);
      await as(app, bob).delete('/api/friends/alice').expect(204);
      expect((await friends(alice)).friends).toEqual([]);
      await as(app, bob).delete('/api/friends/alice').expect(404);
    });

    it('rejects yourself and unknown users', async () => {
      const self = await sendRequest(alice, alice).expect(400);
      expect(self.body).toMatchObject({ code: 'CANNOT_ADD_SELF' });
      const unknown = await as(app, alice)
        .post('/api/friends/requests', { username: 'nobody_here' })
        .expect(404);
      expect(unknown.body).toMatchObject({ code: 'USER_NOT_FOUND' });
    });
  });

  describe('blocks', () => {
    it('cut everything: friendship, search, requests and avatar', async () => {
      await befriend(alice, bob);
      await request(app.getHttpServer())
        .put('/api/profile/avatar/image')
        .set('Cookie', alice.cookie)
        .set('Content-Type', 'image/png')
        .send(PNG)
        .expect(200);
      await as(app, bob).get('/api/users/alice/avatar').expect(200);
      expect((await search(bob, 'alice'))[0].avatar).toEqual({
        kind: 'custom',
        url: expect.stringMatching(/^\/api\/users\/alice\/avatar\?v=/),
      });

      await as(app, alice).post('/api/blocks', { username: 'bobby' }).expect(204);
      expect((await friends(alice)).friends).toEqual([]);
      expect((await friends(bob)).friends).toEqual([]);
      expect(await search(bob, 'alice')).toEqual([]);
      expect(await search(alice, 'bobby')).toEqual([]);
      const blockedRequest = await sendRequest(bob, alice).expect(404);
      expect(blockedRequest.body).toMatchObject({ code: 'USER_NOT_FOUND' });
      await sendRequest(alice, bob).expect(404);
      await as(app, bob).get('/api/users/alice/avatar').expect(404);
      expect(
        names((await as(app, alice).get('/api/blocks').expect(200)).body as PublicUserDto[]),
      ).toEqual(['bobby']);

      await as(app, alice).delete('/api/blocks/bobby').expect(204);
      expect(await search(bob, 'alice')).toMatchObject([{ relation: 'NONE' }]);
      await as(app, alice).delete('/api/blocks/bobby').expect(404);
    });

    it("can't block yourself", async () => {
      const response = await as(app, alice).post('/api/blocks', { username: 'alice' }).expect(400);
      expect(response.body).toMatchObject({ code: 'CANNOT_BLOCK_SELF' });
    });
  });

  it('lets each user choose who sees their profile', async () => {
    const me = async () =>
      (await as(app, alice).get('/api/auth/me').expect(200)).body as UserResponseDto;
    expect((await me()).profileVisibility).toBe('FRIENDS');
    await as(app, alice).put('/api/profile/visibility', { visibility: 'PRIVATE' }).expect(204);
    expect((await me()).profileVisibility).toBe('PRIVATE');
    await as(app, alice).put('/api/profile/visibility', { visibility: 'PUBLIC' }).expect(400);
  });

  describe("a friend's profile", () => {
    let bobGame: UserGameDetailsDto;

    beforeEach(async () => {
      const pc = await dataSource.getRepository(Platform).findOneByOrFail({ slug: 'pc' });
      bobGame = (
        await as(app, bob)
          .post('/api/library', {
            manualGame: { name: 'Hades' },
            platformId: pc.id,
            initialPlaythrough: { status: 'COMPLETED', previousMinutes: 600 },
            rating: 90,
          })
          .expect(201)
      ).body as UserGameDetailsDto;
      await as(app, bob).patch(`/api/library/${bobGame.id}`, { notes: 'Gran juego' }).expect(200);
    });

    it('shows stats, library (with notes) and wishlist to friends, read-only', async () => {
      await befriend(alice, bob);
      const profile = (await as(app, alice).get('/api/users/bobby/profile').expect(200))
        .body as PlayerProfileDto;
      expect(profile).toMatchObject({
        user: { username: 'bobby', avatar: null, memberSince: expect.any(String) },
        self: false,
        relation: 'FRIEND',
        stats: { totalGames: 1, completed: 1, totalMinutes: 600 },
      });
      expect(JSON.stringify(profile)).not.toContain('@');

      const library = (await as(app, alice).get('/api/users/bobby/library').expect(200)).body as {
        id: string;
        rating: number;
      }[];
      expect(library).toMatchObject([{ id: bobGame.id, rating: 90 }]);
      const game = (await as(app, alice).get(`/api/users/bobby/library/${bobGame.id}`).expect(200))
        .body as UserGameDetailsDto;
      expect(game.notes).toBe('Gran juego');
      await as(app, alice).get('/api/users/bobby/wishlist').expect(200);

      // Read-only: the regular routes stay private to the owner.
      await as(app, alice).get(`/api/library/${bobGame.id}`).expect(404);
      await as(app, alice).patch(`/api/library/${bobGame.id}`, { rating: 10 }).expect(404);
      // A game is only reachable through its owner.
      await as(app, alice).get(`/api/users/alice/library/${bobGame.id}`).expect(404);
    });

    it('is hidden from non-friends, blocked users and when private', async () => {
      const hidden = await as(app, carol).get('/api/users/bobby/profile').expect(404);
      expect(hidden.body).toMatchObject({ code: 'USER_NOT_FOUND' });
      await as(app, carol).get('/api/users/bobby/library').expect(404);

      await befriend(alice, bob);
      await as(app, bob).put('/api/profile/visibility', { visibility: 'PRIVATE' }).expect(204);
      const privateProfile = await as(app, alice).get('/api/users/bobby/profile').expect(403);
      expect(privateProfile.body).toMatchObject({ code: 'PROFILE_PRIVATE' });
      await as(app, alice).get('/api/users/bobby/wishlist').expect(403);

      await as(app, bob).put('/api/profile/visibility', { visibility: 'FRIENDS' }).expect(204);
      await as(app, bob).post('/api/blocks', { username: 'alice' }).expect(204);
      await as(app, alice).get('/api/users/bobby/profile').expect(404);
    });

    it('lets you see your own', async () => {
      const own = (await as(app, bob).get('/api/users/BOBBY/profile').expect(200))
        .body as PlayerProfileDto;
      expect(own).toMatchObject({ self: true, relation: 'SELF' });
    });
  });

  it('reports a user to the administrator', async () => {
    const emails = app.get<MockEmailService>(EmailService);
    emails.reset();
    await as(app, alice)
      .post('/api/reports', { username: 'bobby', reason: 'AVATAR', details: ' <b>feo</b> ' })
      .expect(204);
    expect(emails.sent).toHaveLength(1);
    expect(emails.sent[0]).toMatchObject({
      to: 'admin@example.com',
      subject: 'Game Tracker: denuncia de bobby',
    });
    expect(emails.sent[0].text).toContain('Motivo: Avatar ofensivo');
    expect(emails.sent[0].text).toContain('Denunciado por: alice');
    expect(emails.sent[0].html).toContain('&lt;b&gt;feo&lt;/b&gt;');
    // Never anyone's email address in the report.
    expect(emails.sent[0].text).not.toContain('@example.com');

    const self = await as(app, alice)
      .post('/api/reports', { username: 'alice', reason: 'OTHER' })
      .expect(400);
    expect(self.body).toMatchObject({ code: 'CANNOT_REPORT_SELF' });
    await as(app, alice).post('/api/reports', { username: 'bobby', reason: 'BAD' }).expect(400);
    await as(app, alice)
      .post('/api/reports', { username: 'nobody_here', reason: 'OTHER' })
      .expect(404);
  });

  it('requires a session', async () => {
    const server = app.getHttpServer();
    await request(server).get('/api/friends').expect(401);
    await request(server).get('/api/users/search?q=bob').expect(401);
    await request(server).get('/api/blocks').expect(401);
  });
});
