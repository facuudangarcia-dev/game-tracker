import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { AuthenticatedRequest } from './authenticated-request';

export const IS_PUBLIC_KEY = 'isPublic';
export const OPTIONAL_AUTH_KEY = 'optionalAuth';

/** Opts a route out of the global authentication guard. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Public route that still recognizes a valid session: anonymous visitors get
 * through and logged-in users are available through OptionalUser.
 */
export const OptionalAuth = () => SetMetadata(OPTIONAL_AUTH_KEY, true);

/** Injects the authenticated user (only valid on non-public routes). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) =>
    ctx.switchToHttp().getRequest<AuthenticatedRequest>().auth.user,
);

/** The logged-in user on an OptionalAuth route, or null for anonymous visitors. */
export const OptionalUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) =>
    ctx.switchToHttp().getRequest<Partial<AuthenticatedRequest>>().auth?.user ?? null,
);
