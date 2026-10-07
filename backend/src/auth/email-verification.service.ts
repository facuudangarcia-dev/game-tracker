import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, type EntityManager, IsNull, LessThanOrEqual } from 'typeorm';
import type { EnvironmentVariables } from '../config/env.validation';
import { EmailDeliveryError, EmailService } from '../email/email.service';
import { verificationEmail } from '../email/verification-email';
import { User } from '../users/user.entity';
import { normalizeEmail } from '../users/users.service';
import {
  VERIFICATION_CODE_LENGTH,
  VERIFICATION_CODE_TTL_MS,
  VERIFICATION_MAX_ATTEMPTS,
  VERIFICATION_RESEND_COOLDOWN_MS,
} from './auth.constants';

const CODE_SPACE = 10 ** VERIFICATION_CODE_LENGTH;

export type VerificationResult = 'verified' | 'invalid';

/** Columns that hold the pending code, cleared once it is used or invalidated. */
const NO_PENDING_CODE = {
  emailVerificationCodeHash: null,
  emailVerificationCodeExpiresAt: null,
  emailVerificationAttempts: 0,
} as const;

/**
 * Email verification with single-use 6-digit codes (docs/decisions.md #45-#48).
 * Only an HMAC of the code is stored, keyed with AUTH_SECRET and bound to the
 * user, so a database leak doesn't reveal pending codes.
 */
@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);
  private readonly secret: string;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly emails: EmailService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.secret = config.get('AUTH_SECRET', { infer: true });
  }

  /**
   * Generates a new code for `user` (invalidating any previous one), stores its
   * hash and sends it. Delivery errors propagate, so a caller running inside a
   * transaction rolls the change back.
   */
  async issueAndSend(user: User, manager: EntityManager, now = new Date()): Promise<void> {
    const code = this.generateCode();
    await manager.getRepository(User).update({ id: user.id }, this.pendingCode(user, code, now));
    try {
      await this.emails.send(verificationEmail(user.email, user.username, code));
    } catch (error) {
      throw error instanceof EmailDeliveryError ? error : new EmailDeliveryError();
    }
  }

  /**
   * Sends a new code if the account exists, is unverified and is out of the
   * cooldown. Always resolves the same way, so callers can't learn whether the
   * account exists; delivery happens in the background for the same reason.
   */
  async resend(email: string, now = new Date()): Promise<void> {
    const repository = this.dataSource.getRepository(User);
    const user = await repository.findOneBy({ email: normalizeEmail(email), emailVerified: false });
    if (!user) {
      return;
    }

    // Conditional update: concurrent requests can't both pass the cooldown.
    const code = this.generateCode();
    const cooldownStart = new Date(now.getTime() - VERIFICATION_RESEND_COOLDOWN_MS);
    const claimed = await repository.update(
      [
        { id: user.id, emailVerified: false, emailVerificationSentAt: IsNull() },
        {
          id: user.id,
          emailVerified: false,
          emailVerificationSentAt: LessThanOrEqual(cooldownStart),
        },
      ],
      this.pendingCode(user, code, now),
    );
    if (!claimed.affected) {
      return;
    }

    void this.emails.send(verificationEmail(user.email, user.username, code)).catch(async () => {
      this.logger.warn('Verification email could not be delivered (resend)');
      // Lift the cooldown so the user can retry right away.
      await repository
        .update({ id: user.id }, { emailVerificationSentAt: null })
        .catch(() => undefined);
    });
  }

  /**
   * Checks `code` for the account. Wrong, expired, used or unknown codes all give
   * the same 'invalid' result; too many wrong attempts invalidate the code.
   */
  async verify(email: string, code: string, now = new Date()): Promise<VerificationResult> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(User);
      const user = await repository.findOne({
        where: { email: normalizeEmail(email) },
        lock: { mode: 'pessimistic_write' },
      });
      if (
        !user ||
        user.emailVerified ||
        !user.emailVerificationCodeHash ||
        !user.emailVerificationCodeExpiresAt
      ) {
        return 'invalid';
      }

      if (user.emailVerificationCodeExpiresAt <= now) {
        await repository.update({ id: user.id }, NO_PENDING_CODE);
        return 'invalid';
      }

      if (!this.matches(user, code)) {
        const attempts = user.emailVerificationAttempts + 1;
        await repository.update(
          { id: user.id },
          attempts >= VERIFICATION_MAX_ATTEMPTS
            ? NO_PENDING_CODE
            : { emailVerificationAttempts: attempts },
        );
        return 'invalid';
      }

      await repository.update({ id: user.id }, { ...NO_PENDING_CODE, emailVerified: true });
      return 'verified';
    });
  }

  /** Uniform over 000000-999999, from the OS CSPRNG. */
  private generateCode(): string {
    return randomInt(0, CODE_SPACE).toString().padStart(VERIFICATION_CODE_LENGTH, '0');
  }

  private pendingCode(user: User, code: string, now: Date) {
    return {
      emailVerificationCodeHash: this.hashCode(user.id, code),
      emailVerificationCodeExpiresAt: new Date(now.getTime() + VERIFICATION_CODE_TTL_MS),
      emailVerificationAttempts: 0,
      emailVerificationSentAt: now,
    };
  }

  private matches(user: User, code: string): boolean {
    const expected = Buffer.from(user.emailVerificationCodeHash ?? '', 'hex');
    const actual = Buffer.from(this.hashCode(user.id, code), 'hex');
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  private hashCode(userId: string, code: string): string {
    return createHmac('sha256', this.secret)
      .update(`email-verification:${userId}:${code}`)
      .digest('hex');
  }
}
