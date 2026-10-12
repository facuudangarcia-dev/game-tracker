import { messages } from '../../i18n/messages';
import type { Credentials, LoginCredentials } from './api';

/** Mirrors the backend policy (docs/decisions.md #18, #45). The backend remains the authority. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;
export const VERIFICATION_CODE_LENGTH = 6;
/** Mirrors the backend resend cooldown (docs/decisions.md #47). */
export const RESEND_COOLDOWN_SECONDS = 60;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[A-Za-z0-9_]+$/;
const CODE_PATTERN = /^[0-9]{6}$/;
const t = messages.auth.validation;

export type AuthMode = 'login' | 'register';
export type CredentialErrors = Partial<Record<keyof Credentials, string>>;
export type LoginErrors = Partial<Record<keyof LoginCredentials, string>>;

export interface RegistrationValues extends Credentials {
  username: string;
  country: string;
  acceptLegal: boolean;
}
export type RegistrationErrors = Partial<Record<keyof RegistrationValues, string>>;

export function validateEmail(value: string): string | undefined {
  const email = value.trim();
  if (!email) {
    return t.emailRequired;
  }
  return EMAIL_PATTERN.test(email) ? undefined : t.emailInvalid;
}

export function validateCredentials(values: Credentials, mode: AuthMode): CredentialErrors {
  const errors: CredentialErrors = {};

  const emailError = validateEmail(values.email);
  if (emailError) {
    errors.email = emailError;
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

/** Login: only presence and maximum lengths, so a policy change can't lock anyone out. */
export function validateLogin(values: LoginCredentials): LoginErrors {
  const errors: LoginErrors = {};
  if (!values.username.trim()) {
    errors.username = t.usernameRequired;
  }
  if (!values.password) {
    errors.password = t.passwordRequired;
  } else if (values.password.length > PASSWORD_MAX_LENGTH) {
    errors.password = t.passwordTooLong(PASSWORD_MAX_LENGTH);
  }
  return errors;
}

export function validateUsername(value: string): string | undefined {
  const username = value.trim();
  if (!username) {
    return t.usernameRequired;
  }
  if (username.length < USERNAME_MIN_LENGTH || username.length > USERNAME_MAX_LENGTH) {
    return t.usernameLength(USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH);
  }
  return USERNAME_PATTERN.test(username) ? undefined : t.usernameChars;
}

export function validateRegistration(values: RegistrationValues): RegistrationErrors {
  const errors: RegistrationErrors = validateCredentials(values, 'register');
  const usernameError = validateUsername(values.username);
  if (usernameError) {
    errors.username = usernameError;
  }
  if (!values.country) {
    errors.country = t.countryRequired;
  }
  if (!values.acceptLegal) {
    errors.acceptLegal = t.termsRequired;
  }
  return errors;
}

export function validateVerificationCode(value: string): string | undefined {
  return CODE_PATTERN.test(value.trim()) ? undefined : t.codeInvalid;
}
