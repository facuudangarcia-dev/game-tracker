import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';
import { type EnvironmentVariables, NodeEnv } from '../config/env.validation';

/** Reads and writes the HttpOnly session cookie. The token never reaches JavaScript. */
@Injectable()
export class SessionCookie {
  private readonly name: string;
  private readonly options: CookieOptions;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    this.name = config.get('AUTH_COOKIE_NAME', { infer: true });
    this.options = {
      httpOnly: true,
      secure: config.get('NODE_ENV', { infer: true }) === NodeEnv.Production,
      sameSite: 'lax',
      path: '/',
    };
  }

  read(request: Request): string | undefined {
    const cookies = request.cookies as Record<string, unknown> | undefined;
    const value = cookies?.[this.name];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }

  set(response: Response, token: string, expiresAt: Date): void {
    response.cookie(this.name, token, { ...this.options, expires: expiresAt });
  }

  clear(response: Response): void {
    response.clearCookie(this.name, this.options);
  }
}
