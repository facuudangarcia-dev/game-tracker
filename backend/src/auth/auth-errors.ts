import { ForbiddenException } from '@nestjs/common';
import { AuthErrorCode } from './auth.constants';

/**
 * The account exists but its email isn't verified yet: no session, no access.
 * The login includes the email (only after the right password) so the user can
 * go on to verify it, since they log in with their username (decision #76).
 */
export function emailNotVerified(email?: string): ForbiddenException {
  return new ForbiddenException({
    statusCode: 403,
    code: AuthErrorCode.EmailNotVerified,
    message: 'Email not verified',
    ...(email ? { email } : {}),
  });
}
