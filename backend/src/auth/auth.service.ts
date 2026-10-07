import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EmailDeliveryError } from '../email/email.service';
import type { User } from '../users/user.entity';
import {
  EmailAlreadyRegisteredError,
  UsernameTakenError,
  UsersService,
} from '../users/users.service';
import { emailNotVerified } from './auth-errors';
import { AuthErrorCode, PRIVACY_VERSION, TERMS_VERSION } from './auth.constants';
import { EmailVerificationService } from './email-verification.service';
import { PasswordHasher } from './password-hasher.service';
import { type IssuedSession, SessionsService } from './sessions.service';

export interface AuthResult {
  user: User;
  session: IssuedSession;
}

export interface Registration {
  username: string;
  email: string;
  password: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly users: UsersService,
    private readonly passwords: PasswordHasher,
    private readonly sessions: SessionsService,
    private readonly verification: EmailVerificationService,
  ) {}

  /**
   * Creates an unverified account and emails it a verification code. No session
   * is opened (docs/decisions.md #45). Atomic: if the email can't be sent, the
   * account isn't created and the user can simply try again.
   */
  async register(input: Registration, now = new Date()): Promise<User> {
    const passwordHash = await this.passwords.hash(input.password);

    try {
      return await this.dataSource.transaction(async (manager) => {
        const user = await this.users.create(
          {
            email: input.email,
            username: input.username,
            passwordHash,
            termsVersion: TERMS_VERSION,
            privacyVersion: PRIVACY_VERSION,
            acceptedAt: now,
          },
          manager,
        );
        await this.verification.issueAndSend(user, manager, now);
        return user;
      });
    } catch (error) {
      throw mapRegistrationError(error);
    }
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

    // Checked only after the password, so it doesn't reveal which emails exist.
    if (!user.emailVerified) {
      throw emailNotVerified();
    }

    return { user, session: await this.sessions.create(user.id) };
  }

  async verifyEmail(email: string, code: string): Promise<void> {
    if ((await this.verification.verify(email, code)) !== 'verified') {
      throw new BadRequestException({
        statusCode: 400,
        code: AuthErrorCode.InvalidVerificationCode,
        message: 'Invalid or expired verification code',
      });
    }
  }

  resendVerification(email: string): Promise<void> {
    return this.verification.resend(email);
  }

  logout(token: string): Promise<void> {
    return this.sessions.revoke(token);
  }
}

function mapRegistrationError(error: unknown): unknown {
  if (error instanceof EmailAlreadyRegisteredError) {
    return new ConflictException({
      statusCode: 409,
      code: AuthErrorCode.EmailAlreadyRegistered,
      message: 'Email already registered',
    });
  }
  if (error instanceof UsernameTakenError) {
    return new ConflictException({
      statusCode: 409,
      code: AuthErrorCode.UsernameTaken,
      message: 'Username already taken',
    });
  }
  if (error instanceof EmailDeliveryError) {
    return new ServiceUnavailableException({
      statusCode: 503,
      code: AuthErrorCode.EmailDeliveryFailed,
      message: 'The verification email could not be sent',
    });
  }
  return error;
}

function invalidCredentials(): UnauthorizedException {
  // Same response for unknown email and wrong password: no account enumeration.
  return new UnauthorizedException({
    statusCode: 401,
    code: AuthErrorCode.InvalidCredentials,
    message: 'Invalid email or password',
  });
}
