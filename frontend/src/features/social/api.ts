import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { apiFetch } from '../../lib/api/client';
import type { Avatar, User } from '../auth/api';
import { currentUserQueryKey } from '../auth/queryKeys';
import type { UserGameDetails, UserGameListItem } from '../library/types';
import type { PlayerHighlights, PlayerStats } from '../profile/api';
import type { Wishlist } from '../explore/types';

/** Another user: only username and avatar (never the email). */
export interface PublicUser {
  username: string;
  avatar: Avatar;
}

export type Relation = 'NONE' | 'FRIEND' | 'REQUEST_SENT' | 'REQUEST_RECEIVED';

export interface UserSearchResult extends PublicUser {
  relation: Relation;
}

export interface Friend extends PublicUser {
  since: string;
}

export interface Friends {
  friends: Friend[];
  incoming: Friend[];
  outgoing: Friend[];
}

export type ProfileVisibility = 'FRIENDS' | 'PRIVATE';
export type ReportReason = 'AVATAR' | 'USERNAME' | 'OTHER';

export interface PlayerProfile {
  user: PublicUser & { memberSince: string };
  self: boolean;
  relation: 'SELF' | 'FRIEND';
  stats: PlayerStats;
  highlights: PlayerHighlights;
}

export type ActivityType =
  | 'GAME_ADDED'
  | 'STATUS_CHANGED'
  | 'PLATINUM'
  | 'ACHIEVEMENTS'
  | 'RATED'
  | 'FAVORITED'
  | 'WISHLISTED'
  | 'STEAM_IMPORT';

export interface ActivityItem {
  id: string;
  type: ActivityType;
  createdAt: string;
  user: PublicUser;
  self: boolean;
  game: {
    name: string;
    coverUrl: string | null;
    userGameId: string | null;
    provider: string | null;
    externalId: string | null;
  } | null;
  data: { status?: string; rating?: number; count?: number };
}

export interface ActivityPage {
  items: ActivityItem[];
  next: string | null;
}

const user = (username: string) => `/users/${encodeURIComponent(username)}`;

export const socialKeys = {
  all: ['social'] as const,
  friends: ['social', 'friends'] as const,
  blocks: ['social', 'blocks'] as const,
  search: (q: string) => ['social', 'search', q] as const,
  activity: ['social', 'activity'] as const,
  player: (username: string) => ['social', 'player', username.toLowerCase()] as const,
};

/** Friends and requests. Polled, so new requests show up in the header. */
export function useFriends(enabled = true) {
  return useQuery({
    queryKey: socialKeys.friends,
    queryFn: () => apiFetch<Friends>('/friends'),
    enabled,
    refetchInterval: 60_000,
    staleTime: 15_000,
  });
}

export function useUserSearch(q: string) {
  const text = q.trim();
  return useQuery({
    queryKey: socialKeys.search(text.toLowerCase()),
    queryFn: () => apiFetch<UserSearchResult[]>(`/users/search?q=${encodeURIComponent(text)}`),
    enabled: text.length >= 3,
    staleTime: 10_000,
  });
}

export function useBlocks() {
  return useQuery({
    queryKey: socialKeys.blocks,
    queryFn: () => apiFetch<PublicUser[]>('/blocks'),
  });
}

/** Any change between users refreshes friends, searches, blocks and activity. */
function useSocialMutation<T>(mutationFn: (input: T) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: socialKeys.all });
    },
  });
}

export const useSendRequest = () =>
  useSocialMutation((username: string) =>
    apiFetch<{ relation: Relation }>('/friends/requests', {
      method: 'POST',
      body: JSON.stringify({ username }),
    }),
  );

export const useAcceptRequest = () =>
  useSocialMutation((username: string) =>
    apiFetch<unknown>(`/friends/requests/${encodeURIComponent(username)}/accept`, {
      method: 'POST',
    }),
  );

/** Declines a received request or cancels a sent one. */
export const useRemoveRequest = () =>
  useSocialMutation((username: string) =>
    apiFetch<unknown>(`/friends/requests/${encodeURIComponent(username)}`, { method: 'DELETE' }),
  );

export const useUnfriend = () =>
  useSocialMutation((username: string) =>
    apiFetch<unknown>(`/friends/${encodeURIComponent(username)}`, { method: 'DELETE' }),
  );

export const useBlock = () =>
  useSocialMutation((username: string) =>
    apiFetch<unknown>('/blocks', { method: 'POST', body: JSON.stringify({ username }) }),
  );

export const useUnblock = () =>
  useSocialMutation((username: string) =>
    apiFetch<unknown>(`/blocks/${encodeURIComponent(username)}`, { method: 'DELETE' }),
  );

export function useReport() {
  return useMutation({
    mutationFn: (input: { username: string; reason: ReportReason; details: string | null }) =>
      apiFetch<unknown>('/reports', { method: 'POST', body: JSON.stringify(input) }),
  });
}

/** Who sees the current user's profile and activity. */
export function useSetVisibility() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (visibility: ProfileVisibility) =>
      apiFetch<unknown>('/profile/visibility', {
        method: 'PUT',
        body: JSON.stringify({ visibility }),
      }),
    onSuccess: (_result, visibility) => {
      queryClient.setQueryData<User | null>(currentUserQueryKey, (current) =>
        current ? { ...current, profileVisibility: visibility } : current,
      );
    },
  });
}

export function usePlayerProfile(username: string) {
  return useQuery({
    queryKey: [...socialKeys.player(username), 'profile'],
    queryFn: () => apiFetch<PlayerProfile>(`${user(username)}/profile`),
    retry: false,
    staleTime: 0,
  });
}

export function usePlayerLibrary(username: string, enabled = true) {
  return useQuery({
    queryKey: [...socialKeys.player(username), 'library'],
    queryFn: () =>
      apiFetch<UserGameListItem[]>(`${user(username)}/library?sort=createdAt&order=desc`),
    enabled,
    retry: false,
  });
}

export function usePlayerGame(username: string, userGameId: string) {
  return useQuery({
    queryKey: [...socialKeys.player(username), 'game', userGameId],
    queryFn: () => apiFetch<UserGameDetails>(`${user(username)}/library/${userGameId}`),
    retry: false,
  });
}

export function usePlayerWishlist(username: string, enabled = true) {
  return useQuery({
    queryKey: [...socialKeys.player(username), 'wishlist'],
    queryFn: () => apiFetch<Wishlist>(`${user(username)}/wishlist`),
    enabled,
    retry: false,
  });
}

/** The feed (own + friends') or one player's activity, page by page. */
export function useActivity(username?: string) {
  return useInfiniteQuery<
    ActivityPage,
    Error,
    InfiniteData<ActivityPage>,
    readonly unknown[],
    string | null
  >({
    queryKey: username ? [...socialKeys.player(username), 'activity'] : [...socialKeys.activity],
    queryFn: ({ pageParam }) => {
      const base = username ? `${user(username)}/activity` : '/activity';
      return apiFetch<ActivityPage>(
        pageParam ? `${base}?cursor=${encodeURIComponent(pageParam)}` : base,
      );
    },
    initialPageParam: null,
    getNextPageParam: (last) => last.next,
    retry: false,
    staleTime: 0,
  });
}
