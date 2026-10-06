import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import type { DataSource } from 'typeorm';
import type {
  UserGameDetailsDto,
  UserGameListItemDto,
} from '../src/library/dto/user-game-response.dto';
import { Platform } from '../src/platforms/platform.entity';
import { createTestApp } from './create-test-app';
import { as, registerUser, type TestUser } from './test-users';

describe('Library: editing a UserGame (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let resetDatabase: () => Promise<void>;
  let alice: TestUser;
  let userGameId: string;

  beforeAll(async () => {
    ({ app, dataSource, resetDatabase } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase();
    alice = await registerUser(app, 'alice@example.com');
    const pc = await dataSource.getRepository(Platform).findOneByOrFail({ slug: 'pc' });
    userGameId = (
      (
        await as(app, alice)
          .post('/api/library', { manualGame: { name: 'Homebrew' }, platformId: pc.id })
          .expect(201)
      ).body as UserGameDetailsDto
    ).id;
  });

  afterAll(async () => {
    await app.close();
  });

  const patch = (body: object) => as(app, alice).patch(`/api/library/${userGameId}`, body);

  describe('rating', () => {
    it.each([10, 55, 100])('accepts %i', async (rating) => {
      const response = await patch({ rating }).expect(200);
      expect((response.body as UserGameDetailsDto).rating).toBe(rating);
    });

    it.each([9, 101, 55.5, '80', 0, -10])('rejects %p', async (rating) => {
      await patch({ rating }).expect(400);
    });

    it('clears the rating with null and shows it in the list', async () => {
      await patch({ rating: 90 }).expect(200);
      const list = (await as(app, alice).get('/api/library').expect(200))
        .body as UserGameListItemDto[];
      expect(list[0].rating).toBe(90);

      const response = await patch({ rating: null }).expect(200);
      expect((response.body as UserGameDetailsDto).rating).toBeNull();
    });
  });

  describe('general note', () => {
    it('accepts up to 5000 characters and rejects more', async () => {
      await patch({ notes: 'x'.repeat(5000) }).expect(200);
      await patch({ notes: 'x'.repeat(5001) }).expect(400);
    });

    it('stores blank notes as null and keeps other fields unchanged', async () => {
      await patch({ rating: 70, notes: 'Great game' }).expect(200);

      const response = await patch({ notes: '   ' }).expect(200);

      expect(response.body).toMatchObject({ notes: null, rating: 70 });
    });
  });

  it('does not allow changing the game or the platform', async () => {
    await patch({ platformId: '00000000-0000-4000-8000-000000000000' }).expect(400);
    await patch({ gameId: '00000000-0000-4000-8000-000000000000' }).expect(400);
  });

  it("returns 404 when editing another user's game", async () => {
    const bob = await registerUser(app, 'bob@example.com');

    await as(app, bob).patch(`/api/library/${userGameId}`, { rating: 10 }).expect(404);
  });

  it('enforces rating and note limits at the DB level', async () => {
    await expect(
      dataSource.query('UPDATE user_games SET rating = 101 WHERE id = $1', [userGameId]),
    ).rejects.toThrow(/CHK_user_games_rating_range/);
    await expect(
      dataSource.query('UPDATE user_games SET notes = repeat($2, 5001) WHERE id = $1', [
        userGameId,
        'x',
      ]),
    ).rejects.toThrow(/CHK_user_games_notes_length/);
  });
});
