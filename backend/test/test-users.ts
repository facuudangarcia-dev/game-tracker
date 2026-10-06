import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';

export interface TestUser {
  id: string;
  email: string;
  /** "name=value" session cookie, ready for a Cookie header. */
  cookie: string;
}

export async function registerUser(app: INestApplication<App>, email: string): Promise<TestUser> {
  const response = await request(app.getHttpServer())
    .post('/api/auth/register')
    .send({ email, password: 'super-secret-1' })
    .expect(201);
  const cookie = (response.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
  return { id: (response.body as { id: string }).id, email, cookie };
}

/** Authenticated request helpers bound to one user. */
export function as(app: INestApplication<App>, user: TestUser) {
  const server = app.getHttpServer();
  return {
    get: (url: string) => request(server).get(url).set('Cookie', user.cookie),
    post: (url: string, body?: object) =>
      request(server).post(url).set('Cookie', user.cookie).send(body),
    patch: (url: string, body?: object) =>
      request(server).patch(url).set('Cookie', user.cookie).send(body),
    put: (url: string, body?: object) =>
      request(server).put(url).set('Cookie', user.cookie).send(body),
    delete: (url: string) => request(server).delete(url).set('Cookie', user.cookie),
  };
}
