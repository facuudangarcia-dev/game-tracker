import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ASSET_STORAGE, type AssetStorage } from '../assets/asset-storage';
import { EmailDeliveryError } from '../email/email.service';
import { User } from '../users/user.entity';
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
  country: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly users: UsersService,
    private readonly passwords: PasswordHasher,
    private readonly sessions: SessionsService,
    private readonly verification: EmailVerificationService,
    @Inject(ASSET_STORAGE) private readonly storage: AssetStorage,
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
            country: input.country,
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

  /** Logs in with the username, in any case (decision #76). */
  async login(username: string, password: string): Promise<AuthResult> {
    const user = await this.users.findByUsername(username);
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

    // Checked only after the password, so it doesn't reveal which accounts exist.
    if (!user.emailVerified) {
      throw emailNotVerified(user.email);
    }

    return { user, session: await this.sessions.create(user.id) };
  }

  /** Records the acceptance of the current legal documents (decision #88). */
  async acceptLegal(user: User, now = new Date()): Promise<User> {
    await this.dataSource.getRepository(User).update(
      { id: user.id },
      {
        termsVersion: TERMS_VERSION,
        termsAcceptedAt: now,
        privacyVersion: PRIVACY_VERSION,
        privacyAcceptedAt: now,
      },
    );
    return {
      ...user,
      termsVersion: TERMS_VERSION,
      termsAcceptedAt: now,
      privacyVersion: PRIVACY_VERSION,
      privacyAcceptedAt: now,
    };
  }

  /**
   * Deletes the account and everything in it (decision #82), after confirming
   * the password: library, playthroughs, wishlist, Steam link, sessions, the
   * user's manual games and their uploaded images (avatar and covers nobody
   * else uses). Irreversible.
   */
  async deleteAccount(user: User, password: string): Promise<void> {
    if (!(await this.passwords.verify(user.passwordHash, password))) {
      throw new BadRequestException({
        statusCode: 400,
        code: AuthErrorCode.WrongPassword,
        message: 'Wrong password',
      });
    }
    const covers: { key: string }[] = await this.dataSource.query(
      `SELECT DISTINCT cover_asset_key AS key FROM games
       WHERE created_by_user_id = $1 AND cover_asset_key IS NOT NULL`,
      [user.id],
    );
    const keys = [
      ...new Set([
        ...covers.map((c) => c.key),
        ...(user.avatarAssetKey ? [user.avatarAssetKey] : []),
      ]),
    ];
    // Every user row (sessions, library, wishlist, Steam, manual games...) cascades.
    await this.dataSource.query('DELETE FROM users WHERE id = $1', [user.id]);

    // Images are stored by content: only delete the ones nobody else uses.
    for (const key of keys) {
      const [{ used }]: { used: boolean }[] = await this.dataSource.query(
        `SELECT EXISTS (SELECT 1 FROM games WHERE cover_asset_key = $1)
             OR EXISTS (SELECT 1 FROM users WHERE avatar_asset_key = $1) AS used`,
        [key],
      );
      if (!used) {
        await this.storage.delete(key).catch(() => {
          this.logger.warn('An image of a deleted account could not be deleted');
        });
      }
    }
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
