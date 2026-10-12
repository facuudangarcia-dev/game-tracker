import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { AuthErrorCode } from './auth.constants';
import { emailNotVerified } from './auth-errors';
import type { AuthenticatedRequest } from './authenticated-request';
import { IS_PUBLIC_KEY, OPTIONAL_AUTH_KEY } from './decorators';
import { LEGAL_EXEMPT_KEY, needsLegalAcceptance } from './legal';
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
    // Optional auth: an invalid or unverified session is handled as usual (cookie
    // cleared, session revoked) but the visitor continues anonymously.
    const isOptional = this.reflector.getAllAndOverride<boolean>(OPTIONAL_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const token = this.cookie.read(request);
    const session = token ? await this.sessions.validate(token) : null;
    if (!token || !session) {
      if (token) {
        this.cookie.clear(response);
      }
      if (isOptional) {
        return true;
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
      if (isOptional) {
        return true;
      }
      throw emailNotVerified();
    }

    if (session.renewed) {
      this.cookie.set(response, token, session.expiresAt);
    }

    // New legal documents must be accepted before using the app (decision #88).
    const exempt = this.reflector.getAllAndOverride<boolean>(LEGAL_EXEMPT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!exempt && !isOptional && needsLegalAcceptance(session.user)) {
      throw new ForbiddenException({
        statusCode: 403,
        code: AuthErrorCode.LegalAcceptanceRequired,
        message: 'The updated Terms and Privacy policy must be accepted',
      });
    }
    (request as AuthenticatedRequest).auth = { user: session.user, sessionId: session.sessionId };
    return true;
  }
}
