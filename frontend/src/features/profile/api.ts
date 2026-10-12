import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api/client';
import type { User } from '../auth/api';
import { currentUserQueryKey } from '../auth/queryKeys';
import type { AvatarPreset } from './avatarPresets';

export interface PlayerStats {
  totalGames: number;
  completed: number;
  inProgress: number;
  played: number;
  pending: number;
  platinums: number;
  totalMinutes: number;
  rated: number;
  averageRating: number | null;
  playthroughs: number;
  topPlatform: { name: string; shortName: string; games: number } | null;
}

/** A library game as shown in the profile highlights. */
export interface ProfileGame {
  userGameId: string;
  name: string;
  coverUrl: string | null;
  platform: { shortName: string };
}

export interface PlayerHighlights {
  mostPlayed: (ProfileGame & { minutes: number }) | null;
  fastest:
    | (ProfileGame & { minutes: number; playthroughNumber: number; playthroughName: string | null })
    | null;
  highestRated: (ProfileGame & { rating: number }) | null;
  lowestRated: (ProfileGame & { rating: number }) | null;
  favorites: ProfileGame[];
}

/** Most favorite games a player can mark. */
export const FAVORITES_MAX = 5;

export const profileKeys = {
  stats: ['profile', 'stats'] as const,
  highlights: ['profile', 'highlights'] as const,
};

export function usePlayerHighlights(enabled = true) {
  return useQuery({
    queryKey: profileKeys.highlights,
    queryFn: () => apiFetch<PlayerHighlights>('/profile/highlights'),
    enabled,
    staleTime: 0,
  });
}

export function usePlayerStats(enabled = true) {
  return useQuery({
    queryKey: profileKeys.stats,
    queryFn: () => apiFetch<PlayerStats>('/profile/stats'),
    enabled,
    // The library changes elsewhere: refetch whenever the profile opens.
    staleTime: 0,
  });
}

/** Avatar mutations update the current user (profile and anywhere else) with the response. */
function useAvatarMutation<T>(request: (input: T) => Promise<User>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: (user) => queryClient.setQueryData<User | null>(currentUserQueryKey, user),
  });
}

export function useSetAvatarPreset() {
  return useAvatarMutation((preset: AvatarPreset) =>
    apiFetch<User>('/profile/avatar', { method: 'PUT', body: JSON.stringify({ preset }) }),
  );
}

/** Sends the image bytes as the request body (no multipart needed). */
export function useUploadAvatar() {
  return useAvatarMutation((file: File) =>
    apiFetch<User>('/profile/avatar/image', {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    }),
  );
}

export function useRemoveAvatar() {
  return useAvatarMutation(() => apiFetch<User>('/profile/avatar', { method: 'DELETE' }));
}
