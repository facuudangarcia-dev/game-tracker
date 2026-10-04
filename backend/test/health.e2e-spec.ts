import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createTestApp } from './create-test-app';

describe('Health (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health is public and reports the API and database as up', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect({ status: 'ok', database: 'up' });
  });

  it('allows credentialed CORS requests from the frontend origin', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .set('Origin', process.env.FRONTEND_ORIGIN ?? '')
      .expect('Access-Control-Allow-Origin', process.env.FRONTEND_ORIGIN ?? '')
      .expect('Access-Control-Allow-Credentials', 'true');
  });

  it('returns 404 for unknown routes', () => {
    return request(app.getHttpServer()).get('/api/does-not-exist').expect(404);
  });
});
