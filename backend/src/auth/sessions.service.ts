import { createHmac, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import type { EnvironmentVariables } from '../config/env.validation';
import type { User } from '../users/user.entity';
import { SESSION_RENEW_INTERVAL_MS } from './auth.constants';
import { Session } from './session.entity';

const TOKEN_BYTES = 32;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface IssuedSession {
  token: string;
  expiresAt: Date;
}

export interface ValidatedSession {
  user: User;
  sessionId: string;
  expiresAt: Date;
  /** True when the expiration was extended and the cookie must be re-sent. */
  renewed: boolean;
}

@Injectable()
export class SessionsService {
  private readonly secret: string;
  private readonly ttlMs: number;

  constructor(
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.secret = config.get('AUTH_SECRET', { infer: true });
    this.ttlMs = config.get('AUTH_SESSION_TTL_DAYS', { infer: true }) * DAY_MS;
  }

  async create(userId: string, now = new Date()): Promise<IssuedSession> {
    // Opportunistic cleanup of this user's expired sessions.
    await this.sessions.delete({ userId, expiresAt: LessThanOrEqual(now) });

    const token = randomBytes(TOKEN_BYTES).toString('base64url');
    const expiresAt = new Date(now.getTime() + this.ttlMs);
    await this.sessions.insert({ tokenHash: this.hashToken(token), userId, expiresAt });
    return { token, expiresAt };
  }

  /** Returns the session's user, or null if the token is unknown or expired. */
  async validate(token: string, now = new Date()): Promise<ValidatedSession | null> {
    const session = await this.sessions.findOne({
      where: { tokenHash: this.hashToken(token) },
      relations: { user: true },
    });
    if (!session) {
      return null;
    }
    if (session.expiresAt <= now) {
      await this.sessions.delete({ id: session.id });
      return null;
    }

    // Sliding expiration: extend when the session was last renewed over a day ago.
    const remainingMs = session.expiresAt.getTime() - now.getTime();
    if (remainingMs < this.ttlMs - SESSION_RENEW_INTERVAL_MS) {
      const expiresAt = new Date(now.getTime() + this.ttlMs);
      await this.sessions.update({ id: session.id }, { expiresAt });
      return { user: session.user, sessionId: session.id, expiresAt, renewed: true };
    }

    return {
      user: session.user,
      sessionId: session.id,
      expiresAt: session.expiresAt,
      renewed: false,
    };
  }

  async revoke(token: string): Promise<void> {
    await this.sessions.delete({ tokenHash: this.hashToken(token) });
  }

  private hashToken(token: string): string {
    return createHmac('sha256', this.secret).update(token).digest('hex');
  }
}
