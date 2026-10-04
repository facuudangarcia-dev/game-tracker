/** Password policy (docs/decisions.md #18): length only, no composition rules. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export const EMAIL_MAX_LENGTH = 254;

/** Sliding sessions are renewed at most once per this interval (docs/decisions.md #20). */
export const SESSION_RENEW_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Machine-readable error codes; the frontend maps them to user-facing texts. */
export enum AuthErrorCode {
  InvalidCredentials = 'INVALID_CREDENTIALS',
  EmailAlreadyRegistered = 'EMAIL_ALREADY_REGISTERED',
  Unauthenticated = 'UNAUTHENTICATED',
}
