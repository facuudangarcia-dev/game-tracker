import { ApiError, apiFetch } from '../../lib/api/client';

export interface User {
  id: string;
  email: string;
  createdAt: string;
}

export interface Credentials {
  email: string;
  password: string;
}

/** Current user, or null when there is no valid session. */
export async function fetchCurrentUser(): Promise<User | null> {
  try {
    return await apiFetch<User>('/auth/me');
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }
    throw error;
  }
}

export function login(credentials: Credentials): Promise<User> {
  return apiFetch<User>('/auth/login', { method: 'POST', body: JSON.stringify(credentials) });
}

export function register(credentials: Credentials): Promise<User> {
  return apiFetch<User>('/auth/register', { method: 'POST', body: JSON.stringify(credentials) });
}

export async function logout(): Promise<void> {
  await apiFetch<unknown>('/auth/logout', { method: 'POST' });
}
