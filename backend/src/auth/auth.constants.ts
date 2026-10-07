/** Password policy (docs/decisions.md #18): length only, no composition rules. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export const EMAIL_MAX_LENGTH = 254;

/** Usernames are stored lowercase, so uniqueness is case-insensitive. */
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;
export const USERNAME_PATTERN = /^[a-z0-9_]+$/;

/** Sliding sessions are renewed at most once per this interval (docs/decisions.md #20). */
export const SESSION_RENEW_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Email verification (docs/decisions.md #45-#48). */
export const VERIFICATION_CODE_LENGTH = 6;
export const VERIFICATION_CODE_TTL_MS = 10 * 60 * 1000;
export const VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000;
/** Wrong attempts allowed per code before it is invalidated (brute-force protection). */
export const VERIFICATION_MAX_ATTEMPTS = 5;

/** Versions of the legal documents accepted at registration (stored as evidence). */
export const TERMS_VERSION = '2026-10-06';
export const PRIVACY_VERSION = '2026-10-06';

/** Machine-readable error codes; the frontend maps them to user-facing texts. */
export enum AuthErrorCode {
  InvalidCredentials = 'INVALID_CREDENTIALS',
  EmailAlreadyRegistered = 'EMAIL_ALREADY_REGISTERED',
  UsernameTaken = 'USERNAME_TAKEN',
  Unauthenticated = 'UNAUTHENTICATED',
  EmailNotVerified = 'EMAIL_NOT_VERIFIED',
  InvalidVerificationCode = 'INVALID_VERIFICATION_CODE',
  EmailDeliveryFailed = 'EMAIL_DELIVERY_FAILED',
}
