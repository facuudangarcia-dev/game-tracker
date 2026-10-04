import { ConflictException, UnauthorizedException } from '@nestjs/common';
import type { User } from '../users/user.entity';
import { EmailAlreadyRegisteredError, type UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import type { SessionsService } from './sessions.service';

const user = { id: 'user-1', email: 'player@example.com', passwordHash: 'stored-hash' } as User;
const session = { token: 'token', expiresAt: new Date() };

function createService() {
  const users = {
    create: jest.fn(),
    findByEmail: jest.fn(),
    updatePasswordHash: jest.fn(),
  };
  const passwords = {
    hash: jest.fn().mockResolvedValue('new-hash'),
    verify: jest.fn(),
    needsRehash: jest.fn().mockReturnValue(false),
    verifyAgainstDummy: jest.fn().mockResolvedValue(undefined),
  };
  const sessions = { create: jest.fn().mockResolvedValue(session), revoke: jest.fn() };
  const service = new AuthService(
    users as unknown as UsersService,
    passwords,
    sessions as unknown as SessionsService,
  );
  return { service, users, passwords, sessions };
}

describe('AuthService', () => {
  describe('register', () => {
    it('stores the hashed password and opens a session', async () => {
      const { service, users, sessions } = createService();
      users.create.mockResolvedValue(user);

      await expect(service.register(user.email, 'secret-password')).resolves.toEqual({
        user,
        session,
      });
      expect(users.create).toHaveBeenCalledWith(user.email, 'new-hash');
      expect(sessions.create).toHaveBeenCalledWith(user.id);
    });

    it('maps a duplicate email to 409 EMAIL_ALREADY_REGISTERED', async () => {
      const { service, users, sessions } = createService();
      users.create.mockRejectedValue(new EmailAlreadyRegisteredError());

      const error: unknown = await service
        .register(user.email, 'secret-password')
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toMatchObject({
        code: 'EMAIL_ALREADY_REGISTERED',
      });
      expect(sessions.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('opens a session with valid credentials', async () => {
      const { service, users, passwords } = createService();
      users.findByEmail.mockResolvedValue(user);
      passwords.verify.mockResolvedValue(true);

      await expect(service.login(user.email, 'secret-password')).resolves.toEqual({
        user,
        session,
      });
      expect(users.updatePasswordHash).not.toHaveBeenCalled();
    });

    it('rejects a wrong password with INVALID_CREDENTIALS', async () => {
      const { service, users, passwords, sessions } = createService();
      users.findByEmail.mockResolvedValue(user);
      passwords.verify.mockResolvedValue(false);

      const error: unknown = await service.login(user.email, 'wrong').catch((e: unknown) => e);

      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error as UnauthorizedException).getResponse()).toMatchObject({
        code: 'INVALID_CREDENTIALS',
      });
      expect(sessions.create).not.toHaveBeenCalled();
    });

    it('gives the same error for an unknown email and still spends hashing time', async () => {
      const { service, users, passwords } = createService();
      users.findByEmail.mockResolvedValue(null);

      const error: unknown = await service
        .login('nobody@example.com', 'whatever')
        .catch((e: unknown) => e);

      expect((error as UnauthorizedException).getResponse()).toMatchObject({
        code: 'INVALID_CREDENTIALS',
      });
      expect(passwords.verifyAgainstDummy).toHaveBeenCalledWith('whatever');
    });

    it('upgrades the stored hash when its parameters are outdated', async () => {
      const { service, users, passwords } = createService();
      users.findByEmail.mockResolvedValue(user);
      passwords.verify.mockResolvedValue(true);
      passwords.needsRehash.mockReturnValue(true);

      await service.login(user.email, 'secret-password');

      expect(users.updatePasswordHash).toHaveBeenCalledWith(user.id, 'new-hash');
    });
  });
});
