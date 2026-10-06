import { HttpException, type HttpStatus } from '@nestjs/common';

/**
 * Error with a stable machine-readable `code` (the frontend maps codes to
 * texts). Messages are for developers and never include sensitive data.
 */
export function apiError(status: HttpStatus, code: string, message: string): HttpException {
  return new HttpException({ statusCode: status, code, message }, status);
}
