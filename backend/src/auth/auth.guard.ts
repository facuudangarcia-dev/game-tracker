import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { AuthErrorCode } from './auth.constants';
import { emailNotVerified } from './auth-errors';
import type { AuthenticatedRequest } from './authenticated-request';
import { IS_PUBLIC_KEY } from './decorators';
import { SessionCookie } from './session-cookie.service';
import { SessionsService } from './sessions.service';

/**
 * Global guard: every route requires a valid session unless marked @Public().
 * Secure by default, so new endpoints can't be exposed by accident.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionsService,
    private readonly cookie: SessionCookie,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const token = this.cookie.read(request);
    const session = token ? await this.sessions.validate(token) : null;
    if (!token || !session) {
      if (token) {
        this.cookie.clear(response);
      }
      throw new UnauthorizedException({
        statusCode: 401,
        code: AuthErrorCode.Unauthenticated,
        message: 'Authentication required',
      });
    }

    // Total block for unverified accounts, whatever the client does (docs/decisions.md #46).
    if (!session.user.emailVerified) {
      await this.sessions.revoke(token);
      this.cookie.clear(response);
      throw emailNotVerified();
    }

    if (session.renewed) {
      this.cookie.set(response, token, session.expiresAt);
    }
    (request as AuthenticatedRequest).auth = { user: session.user, sessionId: session.sessionId };
    return true;
  }
}
