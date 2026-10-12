import { ApiError, apiFetch } from '../../lib/api/client';

export type Avatar = { kind: 'preset'; preset: string } | { kind: 'custom'; url: string } | null;

export interface User {
  id: string;
  username: string;
  email: string;
  emailVerified: boolean;
  avatar: Avatar;
  /** Country of prices chosen in the profile (decision #68); null = not chosen. */
  country: string | null;
  /** Who sees the profile and activity (decision #84). */
  profileVisibility: 'FRIENDS' | 'PRIVATE';
  /** The Terms or the Privacy policy changed since they were accepted (decision #88). */
  legalAcceptanceRequired: boolean;
  createdAt: string;
}

export interface Credentials {
  email: string;
  password: string;
}

/** Login with the username, in any case (decision #76). */
export interface LoginCredentials {
  username: string;
  password: string;
}

export interface Registration extends Credentials {
  username: string;
  /** One checkbox accepts both documents; the backend stores each acceptance. */
  acceptTerms: boolean;
  acceptPrivacy: boolean;
  /** Country of prices and deals (ISO 3166-1 alpha-2). */
  country: string;
}

export interface EmailVerification {
  email: string;
  code: string;
}

/** True for the error the backend returns for accounts whose email isn't verified. */
export function isEmailNotVerified(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 403 &&
    (error.body as { code?: unknown } | null)?.code === 'EMAIL_NOT_VERIFIED'
  );
}

/** Email of an unverified account, given by the login after the right password. */
export function unverifiedEmail(error: unknown): string | null {
  if (!isEmailNotVerified(error)) {
    return null;
  }
  const email = ((error as ApiError).body as { email?: unknown } | null)?.email;
  return typeof email === 'string' ? email : null;
}

/** Current user, or null when there is no valid (verified) session. */
export async function fetchCurrentUser(): Promise<User | null> {
  try {
    return await apiFetch<User>('/auth/me');
  } catch (error) {
    if ((error instanceof ApiError && error.status === 401) || isEmailNotVerified(error)) {
      return null;
    }
    throw error;
  }
}

export function login(credentials: LoginCredentials): Promise<User> {
  return apiFetch<User>('/auth/login', { method: 'POST', body: JSON.stringify(credentials) });
}

/** Creates an unverified account; it doesn't log in. */
export function register(registration: Registration): Promise<User> {
  return apiFetch<User>('/auth/register', { method: 'POST', body: JSON.stringify(registration) });
}

export async function verifyEmail(verification: EmailVerification): Promise<void> {
  await apiFetch<unknown>('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify(verification),
  });
}

export async function resendVerification(email: string): Promise<void> {
  await apiFetch<unknown>('/auth/resend-verification', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

/** Deletes the account and all its data; also ends the session. */
export async function deleteAccount(password: string): Promise<void> {
  await apiFetch<unknown>('/auth/delete-account', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

export async function logout(): Promise<void> {
  await apiFetch<unknown>('/auth/logout', { method: 'POST' });
}
