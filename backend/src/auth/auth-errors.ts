import { ForbiddenException } from '@nestjs/common';
import { AuthErrorCode } from './auth.constants';

/** The account exists but its email isn't verified yet: no session, no access. */
export function emailNotVerified(): ForbiddenException {
  return new ForbiddenException({
    statusCode: 403,
    code: AuthErrorCode.EmailNotVerified,
    message: 'Email not verified',
  });
}
