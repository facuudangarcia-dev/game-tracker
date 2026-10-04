import { ConfigService } from '@nestjs/config';
import type { Repository } from 'typeorm';
import type { EnvironmentVariables } from '../config/env.validation';
import type { User } from '../users/user.entity';
import type { Session } from './session.entity';
import { SessionsService } from './sessions.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const TTL_DAYS = 30;

function createService() {
  const repo = {
    delete: jest.fn().mockResolvedValue(undefined),
    insert: jest.fn<Promise<void>, [Partial<Session>]>().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    findOne: jest.fn(),
  };
  const config = new ConfigService({
    AUTH_SECRET: 's'.repeat(32),
    AUTH_SESSION_TTL_DAYS: TTL_DAYS,
  });
  const service = new SessionsService(
    repo as unknown as Repository<Session>,
    config as unknown as ConfigService<EnvironmentVariables, true>,
  );
  return { service, repo };
}

const user = { id: 'user-1', email: 'a@b.c' } as User;

function storedSession(expiresAt: Date): Session {
  return { id: 'session-1', tokenHash: 'hash', userId: user.id, user, expiresAt } as Session;
}

describe('SessionsService', () => {
  const now = new Date('2026-10-04T12:00:00Z');

  it('creates a random token, stores only its hash and expires after the TTL', async () => {
    const { service, repo } = createService();

    const { token, expiresAt } = await service.create(user.id, now);

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(expiresAt.getTime()).toBe(now.getTime() + TTL_DAYS * DAY_MS);
    const inserted = repo.insert.mock.calls[0][0];
    expect(inserted.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(inserted.tokenHash).not.toContain(token);
  });

  it('hashes the same token deterministically so it can be looked up', async () => {
    const { service, repo } = createService();
    const { token } = await service.create(user.id, now);
    const { tokenHash } = repo.insert.mock.calls[0][0];

    repo.findOne.mockResolvedValue(null);
    await service.validate(token, now);

    expect(repo.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { tokenHash } }));
  });

  it('returns null for unknown tokens', async () => {
    const { service, repo } = createService();
    repo.findOne.mockResolvedValue(null);

    await expect(service.validate('unknown', now)).resolves.toBeNull();
  });

  it('deletes and rejects expired sessions', async () => {
    const { service, repo } = createService();
    repo.findOne.mockResolvedValue(storedSession(new Date(now.getTime() - 1)));

    await expect(service.validate('token', now)).resolves.toBeNull();
    expect(repo.delete).toHaveBeenCalledWith({ id: 'session-1' });
  });

  it('does not renew a session renewed less than a day ago', async () => {
    const { service, repo } = createService();
    const expiresAt = new Date(now.getTime() + TTL_DAYS * DAY_MS - DAY_MS / 2);
    repo.findOne.mockResolvedValue(storedSession(expiresAt));

    const result = await service.validate('token', now);

    expect(result).toMatchObject({ user, renewed: false, expiresAt });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('slides the expiration when the session was renewed over a day ago', async () => {
    const { service, repo } = createService();
    repo.findOne.mockResolvedValue(storedSession(new Date(now.getTime() + 10 * DAY_MS)));

    const result = await service.validate('token', now);

    const newExpiry = new Date(now.getTime() + TTL_DAYS * DAY_MS);
    expect(result).toMatchObject({ renewed: true, expiresAt: newExpiry });
    expect(repo.update).toHaveBeenCalledWith({ id: 'session-1' }, { expiresAt: newExpiry });
  });
});
