import { messages } from '../../i18n/messages';
import type { Credentials } from './api';

/** Mirrors the backend policy (docs/decisions.md #18). The backend remains the authority. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const t = messages.auth.validation;

export type AuthMode = 'login' | 'register';
export type CredentialErrors = Partial<Record<keyof Credentials, string>>;

export function validateCredentials(values: Credentials, mode: AuthMode): CredentialErrors {
  const errors: CredentialErrors = {};
  const email = values.email.trim();

  if (!email) {
    errors.email = t.emailRequired;
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = t.emailInvalid;
  }

  if (!values.password) {
    errors.password = t.passwordRequired;
  } else if (values.password.length > PASSWORD_MAX_LENGTH) {
    errors.password = t.passwordTooLong(PASSWORD_MAX_LENGTH);
  } else if (mode === 'register' && values.password.length < PASSWORD_MIN_LENGTH) {
    errors.password = t.passwordTooShort(PASSWORD_MIN_LENGTH);
  }

  return errors;
}
