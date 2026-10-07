import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { EmailService } from '../src/email/email.service';
import type { MockEmailService } from './mock-email-service';

export const TEST_PASSWORD = 'super-secret-1';

export interface TestUser {
  id: string;
  username: string;
  email: string;
  /** "name=value" session cookie, ready for a Cookie header. */
  cookie: string;
}

/** Username derived from the email's local part (valid for the test addresses). */
export function usernameFor(email: string): string {
  return email.split('@')[0].replace(/[^a-z0-9_]/gi, '_');
}

export function registrationBody(email: string, overrides: object = {}) {
  return {
    username: usernameFor(email),
    email,
    password: TEST_PASSWORD,
    acceptTerms: true,
    acceptPrivacy: true,
    ...overrides,
  };
}

/** Full sign-up: register, verify the emailed code and log in. */
export async function registerUser(app: INestApplication<App>, email: string): Promise<TestUser> {
  const server = app.getHttpServer();
  const emails = app.get<MockEmailService>(EmailService);

  const registered = await request(server)
    .post('/api/auth/register')
    .send(registrationBody(email))
    .expect(201);
  await request(server)
    .post('/api/auth/verify-email')
    .send({ email, code: emails.lastCode(email) })
    .expect(204);
  const response = await request(server)
    .post('/api/auth/login')
    .send({ email, password: TEST_PASSWORD })
    .expect(200);

  const cookie = (response.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
  const body = registered.body as { id: string; username: string };
  return { id: body.id, username: body.username, email, cookie };
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
