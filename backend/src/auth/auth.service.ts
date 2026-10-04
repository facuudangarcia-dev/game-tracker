import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { User } from '../users/user.entity';
import { EmailAlreadyRegisteredError, UsersService } from '../users/users.service';
import { AuthErrorCode } from './auth.constants';
import { PasswordHasher } from './password-hasher.service';
import { type IssuedSession, SessionsService } from './sessions.service';

export interface AuthResult {
  user: User;
  session: IssuedSession;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly passwords: PasswordHasher,
    private readonly sessions: SessionsService,
  ) {}

  /** Creates the account and logs the user in (docs/decisions.md #19). */
  async register(email: string, password: string): Promise<AuthResult> {
    const passwordHash = await this.passwords.hash(password);

    let user: User;
    try {
      user = await this.users.create(email, passwordHash);
    } catch (error) {
      if (error instanceof EmailAlreadyRegisteredError) {
        throw new ConflictException({
          statusCode: 409,
          code: AuthErrorCode.EmailAlreadyRegistered,
          message: 'Email already registered',
        });
      }
      throw error;
    }

    return { user, session: await this.sessions.create(user.id) };
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const user = await this.users.findByEmail(email);
    if (!user) {
      await this.passwords.verifyAgainstDummy(password);
      throw invalidCredentials();
    }
    if (!(await this.passwords.verify(user.passwordHash, password))) {
      throw invalidCredentials();
    }

    if (this.passwords.needsRehash(user.passwordHash)) {
      await this.users.updatePasswordHash(user.id, await this.passwords.hash(password));
    }

    return { user, session: await this.sessions.create(user.id) };
  }

  logout(token: string): Promise<void> {
    return this.sessions.revoke(token);
  }
}

function invalidCredentials(): UnauthorizedException {
  // Same response for unknown email and wrong password: no account enumeration.
  return new UnauthorizedException({
    statusCode: 401,
    code: AuthErrorCode.InvalidCredentials,
    message: 'Invalid email or password',
  });
}
