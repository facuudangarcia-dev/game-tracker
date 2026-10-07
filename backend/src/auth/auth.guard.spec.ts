import { type ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { User } from '../users/user.entity';
import { AuthGuard } from './auth.guard';
import type { AuthenticatedRequest } from './authenticated-request';
import type { SessionCookie } from './session-cookie.service';
import type { SessionsService } from './sessions.service';

const user = { id: 'user-1', emailVerified: true } as User;

function setup({ isPublic = false, token }: { isPublic?: boolean; token?: string }) {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(isPublic) };
  const sessions = { validate: jest.fn(), revoke: jest.fn() };
  const cookie = { read: jest.fn().mockReturnValue(token), set: jest.fn(), clear: jest.fn() };
  const request = {} as AuthenticatedRequest;
  const response = {};
  const context = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as unknown as ExecutionContext;
  const guard = new AuthGuard(
    reflector as unknown as Reflector,
    sessions as unknown as SessionsService,
    cookie as unknown as SessionCookie,
  );
  return { guard, sessions, cookie, request, response, context };
}

describe('AuthGuard', () => {
  it('lets public routes through without a session', async () => {
    const { guard, context, sessions } = setup({ isPublic: true });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(sessions.validate).not.toHaveBeenCalled();
  });

  it('rejects requests without a session cookie', async () => {
    const { guard, context } = setup({});

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an invalid session and clears the stale cookie', async () => {
    const { guard, context, sessions, cookie, response } = setup({ token: 'stale' });
    sessions.validate.mockResolvedValue(null);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(cookie.clear).toHaveBeenCalledWith(response);
  });

  it('attaches the user to the request for a valid session', async () => {
    const { guard, context, sessions, cookie, request } = setup({ token: 'valid' });
    sessions.validate.mockResolvedValue({
      user,
      sessionId: 's1',
      expiresAt: new Date(),
      renewed: false,
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.auth).toEqual({ user, sessionId: 's1' });
    expect(cookie.set).not.toHaveBeenCalled();
  });

  it('re-sends the cookie when the session expiration was extended', async () => {
    const { guard, context, sessions, cookie, response } = setup({ token: 'valid' });
    const expiresAt = new Date();
    sessions.validate.mockResolvedValue({ user, sessionId: 's1', expiresAt, renewed: true });

    await guard.canActivate(context);

    expect(cookie.set).toHaveBeenCalledWith(response, 'valid', expiresAt);
  });

  it('blocks an unverified user even with a valid session, and ends that session', async () => {
    const { guard, context, sessions, cookie, request, response } = setup({ token: 'valid' });
    sessions.validate.mockResolvedValue({
      user: { ...user, emailVerified: false },
      sessionId: 's1',
      expiresAt: new Date(),
      renewed: false,
    });

    const error: unknown = await guard.canActivate(context).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).getResponse()).toMatchObject({
      code: 'EMAIL_NOT_VERIFIED',
    });
    expect(sessions.revoke).toHaveBeenCalledWith('valid');
    expect(cookie.clear).toHaveBeenCalledWith(response);
    expect(request.auth).toBeUndefined();
  });
});
