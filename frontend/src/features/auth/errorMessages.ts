import { messages } from '../../i18n/messages';
import { ApiError } from '../../lib/api/client';

const t = messages.auth.serverErrors;

function hasKnownCode(code: unknown): code is keyof typeof t {
  return typeof code === 'string' && code in t;
}

/** Maps an auth API failure to a user-facing message. */
export function getAuthErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return messages.errors.network;
  }
  const code = (error.body as { code?: unknown } | null)?.code;
  if (hasKnownCode(code)) {
    return t[code];
  }
  if (error.status === 429) {
    return t.TOO_MANY_REQUESTS;
  }
  if (error.status === 400) {
    return t.INVALID_DATA;
  }
  return messages.errors.unexpected;
}
