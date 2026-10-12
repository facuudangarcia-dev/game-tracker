import {
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { EmailDeliveryError } from '../email/email.service';
import type { User } from '../users/user.entity';
import {
  EmailAlreadyRegisteredError,
  UsernameTakenError,
  type UsersService,
} from '../users/users.service';
import { AuthService } from './auth.service';
import type { EmailVerificationService } from './email-verification.service';
import type { SessionsService } from './sessions.service';

const user = {
  id: 'user-1',
  email: 'player@example.com',
  username: 'player',
  passwordHash: 'stored-hash',
  emailVerified: true,
} as User;
const session = { token: 'token', expiresAt: new Date() };
const registration = {
  username: 'player',
  email: user.email,
  password: 'secret-password',
  country: 'AR',
};

function createService() {
  const manager = { name: 'transaction-manager' };
  const dataSource = {
    transaction: jest.fn((work: (m: unknown) => Promise<unknown>) => work(manager)),
  };
  const users = {
    create: jest.fn(),
    findByEmail: jest.fn(),
    findByUsername: jest.fn(),
    updatePasswordHash: jest.fn(),
  };
  const passwords = {
    hash: jest.fn().mockResolvedValue('new-hash'),
    verify: jest.fn(),
    needsRehash: jest.fn().mockReturnValue(false),
    verifyAgainstDummy: jest.fn().mockResolvedValue(undefined),
  };
  const sessions = { create: jest.fn().mockResolvedValue(session), revoke: jest.fn() };
  const verification = {
    issueAndSend: jest.fn().mockResolvedValue(undefined),
    verify: jest.fn(),
    resend: jest.fn(),
  };
  const service = new AuthService(
    dataSource as unknown as DataSource,
    users as unknown as UsersService,
    passwords,
    sessions as unknown as SessionsService,
    verification as unknown as EmailVerificationService,
    { put: jest.fn(), get: jest.fn(), delete: jest.fn() },
  );
  return { service, manager, users, passwords, sessions, verification };
}

async function errorOf(promise: Promise<unknown>): Promise<unknown> {
  return promise.catch((e: unknown) => e);
}

describe('AuthService', () => {
  describe('register', () => {
    it('creates an unverified user with the legal versions, sends the code and opens no session', async () => {
      const { service, manager, users, sessions, verification } = createService();
      const created = { ...user, emailVerified: false };
      users.create.mockResolvedValue(created);
      const now = new Date('2026-10-06T12:00:00Z');

      await expect(service.register(registration, now)).resolves.toBe(created);

      expect(users.create).toHaveBeenCalledWith(
        {
          email: user.email,
          username: 'player',
          country: 'AR',
          passwordHash: 'new-hash',
          termsVersion: '2026-10-11',
          privacyVersion: '2026-10-11',
          acceptedAt: now,
        },
        manager,
      );
      expect(verification.issueAndSend).toHaveBeenCalledWith(created, manager, now);
      expect(sessions.create).not.toHaveBeenCalled();
    });

    it.each([
      [new EmailAlreadyRegisteredError(), ConflictException, 'EMAIL_ALREADY_REGISTERED'],
      [new UsernameTakenError(), ConflictException, 'USERNAME_TAKEN'],
    ])('maps %s to 409', async (cause, type, code) => {
      const { service, users, verification } = createService();
      users.create.mockRejectedValue(cause);

      const error = await errorOf(service.register(registration));

      expect(error).toBeInstanceOf(type);
      expect((error as ConflictException).getResponse()).toMatchObject({ code });
      expect(verification.issueAndSend).not.toHaveBeenCalled();
    });

    it('fails with 503 (rolling the account back) when the email cannot be sent', async () => {
      const { service, users, verification } = createService();
      users.create.mockResolvedValue(user);
      verification.issueAndSend.mockRejectedValue(new EmailDeliveryError());

      const error = await errorOf(service.register(registration));

      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect((error as ServiceUnavailableException).getResponse()).toMatchObject({
        code: 'EMAIL_DELIVERY_FAILED',
      });
    });
  });

  describe('login', () => {
    it('opens a session with valid credentials', async () => {
      const { service, users, passwords } = createService();
      users.findByUsername.mockResolvedValue(user);
      passwords.verify.mockResolvedValue(true);

      await expect(service.login(user.username, 'secret-password')).resolves.toEqual({
        user,
        session,
      });
      expect(users.updatePasswordHash).not.toHaveBeenCalled();
    });

    it('rejects a wrong password with INVALID_CREDENTIALS', async () => {
      const { service, users, passwords, sessions } = createService();
      users.findByUsername.mockResolvedValue(user);
      passwords.verify.mockResolvedValue(false);

      const error: unknown = await service.login(user.username, 'wrong').catch((e: unknown) => e);

      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error as UnauthorizedException).getResponse()).toMatchObject({
        code: 'INVALID_CREDENTIALS',
      });
      expect(sessions.create).not.toHaveBeenCalled();
    });

    it('gives the same error for an unknown username and still spends hashing time', async () => {
      const { service, users, passwords } = createService();
      users.findByUsername.mockResolvedValue(null);

      const error: unknown = await service.login('nobody', 'whatever').catch((e: unknown) => e);

      expect((error as UnauthorizedException).getResponse()).toMatchObject({
        code: 'INVALID_CREDENTIALS',
      });
      expect(passwords.verifyAgainstDummy).toHaveBeenCalledWith('whatever');
    });

    it('refuses an unverified account (after checking the password) without a session', async () => {
      const { service, users, passwords, sessions } = createService();
      users.findByUsername.mockResolvedValue({ ...user, emailVerified: false });
      passwords.verify.mockResolvedValue(true);

      const error = await errorOf(service.login(user.username, 'secret-password'));

      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toMatchObject({
        code: 'EMAIL_NOT_VERIFIED',
        email: user.email,
      });
      expect(sessions.create).not.toHaveBeenCalled();
    });

    it('reports a wrong password as INVALID_CREDENTIALS even for an unverified account', async () => {
      const { service, users, passwords } = createService();
      users.findByUsername.mockResolvedValue({ ...user, emailVerified: false });
      passwords.verify.mockResolvedValue(false);

      const error = await errorOf(service.login(user.username, 'wrong'));

      expect((error as UnauthorizedException).getResponse()).toMatchObject({
        code: 'INVALID_CREDENTIALS',
      });
    });

    it('upgrades the stored hash when its parameters are outdated', async () => {
      const { service, users, passwords } = createService();
      users.findByUsername.mockResolvedValue(user);
      passwords.verify.mockResolvedValue(true);
      passwords.needsRehash.mockReturnValue(true);

      await service.login(user.username, 'secret-password');

      expect(users.updatePasswordHash).toHaveBeenCalledWith(user.id, 'new-hash');
    });
  });
});
