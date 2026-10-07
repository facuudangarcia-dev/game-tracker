import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api/client';
import type { User } from '../auth/api';
import { currentUserQueryKey } from '../auth/queryKeys';
import type { AvatarPreset } from './avatarPresets';

export interface PlayerStats {
  totalGames: number;
  completed: number;
  inProgress: number;
  pending: number;
  platinums: number;
  totalMinutes: number;
  rated: number;
  averageRating: number | null;
  playthroughs: number;
  topPlatform: { name: string; shortName: string; games: number } | null;
}

export const profileKeys = { stats: ['profile', 'stats'] as const };

export function usePlayerStats() {
  return useQuery({
    queryKey: profileKeys.stats,
    queryFn: () => apiFetch<PlayerStats>('/profile/stats'),
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
