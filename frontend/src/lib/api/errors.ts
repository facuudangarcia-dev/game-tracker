import { messages } from '../../i18n/messages';
import { ApiError } from './client';

/** Stable error code sent by the backend (`{ code: '...' }`), if any. */
export function getErrorCode(error: unknown): string | undefined {
  if (!(error instanceof ApiError)) {
    return undefined;
  }
  const code = (error.body as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : undefined;
}

/** Maps an API failure to a user-facing text, using the given code → text table. */
export function getApiErrorMessage(
  error: unknown,
  codeMessages: Readonly<Record<string, string>> = {},
): string {
  if (!(error instanceof ApiError)) {
    return messages.errors.network;
  }
  const code = getErrorCode(error);
  if (code && code in codeMessages) {
    return codeMessages[code];
  }
  if (error.status === 400) {
    return messages.errors.invalidData;
  }
  return messages.errors.unexpected;
}
