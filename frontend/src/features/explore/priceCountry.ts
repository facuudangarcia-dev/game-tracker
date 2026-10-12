import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { apiFetch } from '../../lib/api/client';
import type { User } from '../auth/api';
import { currentUserQueryKey } from '../auth/queryKeys';
import { useCurrentUser } from '../auth/useCurrentUser';
import { browserCountry, isCountryCode } from './countries';

const STORAGE_KEY = 'gt.priceCountry';

function readStored(): string | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isCountryCode(stored) ? stored : null;
  } catch {
    // Storage blocked: no remembered choice.
    return null;
  }
}

/** The choice when the browser's storage is blocked (it still applies to this visit). */
let unstored: string | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Remembers a visitor's choice in this browser. */
function storeCountry(country: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, country);
  } catch {
    unstored = country;
  }
  listeners.forEach((listener) => listener());
}

/**
 * Country whose prices are shown (decision #68): the one in the user's profile,
 * else the one chosen in this browser, else the browser's region. Undefined
 * when none is known: the backend then uses its default country.
 */
export function usePriceCountry(): string | undefined {
  const { data: user } = useCurrentUser();
  const remembered = useSyncExternalStore(subscribe, () => readStored() ?? unstored);
  return user?.country ?? remembered ?? browserCountry() ?? undefined;
}

/** Changes the country of prices: in the profile with a session, else in this browser. */
export function useChangePriceCountry() {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: (country: string) =>
      apiFetch<User>('/profile/country', { method: 'PUT', body: JSON.stringify({ country }) }),
    onSuccess: (updated) => queryClient.setQueryData<User | null>(currentUserQueryKey, updated),
  });
  const change = (country: string) => {
    if (user) {
      save.mutate(country);
    } else {
      storeCountry(country);
    }
  };
  return { change, saving: save.isPending, failed: save.isError };
}
