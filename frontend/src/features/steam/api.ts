import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { apiFetch, apiUrl } from '../../lib/api/client';
import { libraryKeys } from '../library/queries';

export interface SteamAccount {
  personaName: string | null;
  linkedAt: string;
  lastSyncedAt: string | null;
  syncing: boolean;
  /** Error code of the last sync (PRIVATE_PROFILE, STEAM_UNAVAILABLE, CATALOG_UNAVAILABLE). */
  syncError: string | null;
  progress: { done: number; total: number };
  /** Games Steam added to the library (unlinking can delete them). */
  importedGames: number;
  /** Games found by the syncs, waiting for the user's review (decision #80). */
  pendingGames: number;
}

/** A Steam game found by a sync, offered to the user. */
export interface SteamPendingGame {
  appId: number;
  name: string;
  minutes: number;
  coverUrl: string | null;
  /** Not in the catalog: it'd be added as a manual game. */
  manual: boolean;
  /** Already in the library on PC: Steam's hours and achievements are added to it. */
  inLibrary: boolean;
}

export interface SteamStatus {
  configured: boolean;
  account: SteamAccount | null;
  excluded: { appId: number; name: string }[];
}

export const steamKeys = {
  status: ['steam', 'status'] as const,
  pending: ['steam', 'pending'] as const,
};

/** Where the browser goes to link Steam (Steam's own login page). */
export const STEAM_LINK_URL = apiUrl('/steam/link');

/**
 * Steam link and sync state (decision #78). Polled while a sync runs; when it
 * ends, the library is refreshed (new games, hours and achievements).
 */
export function useSteamStatus() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: steamKeys.status,
    queryFn: () => apiFetch<SteamStatus>('/steam'),
    refetchInterval: (current) => (current.state.data?.account?.syncing ? 2000 : false),
    staleTime: 30_000,
  });
  const syncing = query.data?.account?.syncing ?? false;
  const wasSyncing = useRef(syncing);
  useEffect(() => {
    if (wasSyncing.current && !syncing) {
      void queryClient.invalidateQueries({ queryKey: libraryKeys.all });
    }
    wasSyncing.current = syncing;
  }, [syncing, queryClient]);
  return query;
}

function isSteamStatus(value: unknown): value is SteamStatus {
  return typeof value === 'object' && value !== null && 'configured' in value;
}

function useSteamMutation<T>(
  mutationFn: (input: T) => Promise<unknown>,
  { refreshLibrary = false } = {},
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (result) => {
      if (refreshLibrary) {
        void queryClient.invalidateQueries({ queryKey: libraryKeys.all });
      }
      if (isSteamStatus(result)) {
        queryClient.setQueryData(steamKeys.status, result);
      } else {
        void queryClient.invalidateQueries({ queryKey: steamKeys.status });
      }
    },
  });
}

/** Starts a sync: automatic (only if 6+ hours old) or manual (5 minutes between them). */
export function useSteamSync() {
  return useSteamMutation((auto: boolean) =>
    apiFetch<SteamStatus>('/steam/sync', { method: 'POST', body: JSON.stringify({ auto }) }),
  );
}

/**
 * Unlinks Steam. With `deleteGames`, the games Steam added are deleted (and the
 * ones the user already had lose Steam's hours and achievements).
 */
export function useUnlinkSteam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (deleteGames: boolean) =>
      apiFetch<unknown>(`/steam?deleteGames=${deleteGames}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: steamKeys.status });
      void queryClient.invalidateQueries({ queryKey: libraryKeys.all });
    },
  });
}

/** The games found by the syncs, for the review dialog. */
export function usePendingSteamGames(enabled: boolean) {
  return useQuery({
    queryKey: steamKeys.pending,
    queryFn: () => apiFetch<SteamPendingGame[]>('/steam/pending'),
    enabled,
    staleTime: 0,
  });
}

/** Adds the chosen found games (in the background); the rest become removed games. */
export function useConfirmSteamGames() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (appIds: number[]) =>
      apiFetch<SteamStatus>('/steam/pending', {
        method: 'POST',
        body: JSON.stringify({ appIds }),
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(steamKeys.status, result);
      queryClient.removeQueries({ queryKey: steamKeys.pending });
      // A quick import may already be done; longer ones refresh it when they end.
      void queryClient.invalidateQueries({ queryKey: libraryKeys.all });
    },
  });
}

/** Adds a removed Steam game again. */
export function useRestoreSteamGame() {
  return useSteamMutation(
    (appId: number) => apiFetch<SteamStatus>(`/steam/excluded/${appId}`, { method: 'DELETE' }),
    { refreshLibrary: true },
  );
}
