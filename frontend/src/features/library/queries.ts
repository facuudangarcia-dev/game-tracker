import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addUserGame, fetchLibrary, fetchPlatforms, fetchUserGame, searchCatalog } from './api';

export const libraryKeys = {
  all: ['library'] as const,
  list: () => [...libraryKeys.all, 'list'] as const,
  detail: (userGameId: string) => [...libraryKeys.all, 'detail', userGameId] as const,
};

export const SEARCH_MIN_LENGTH = 2;

export function useLibrary() {
  return useQuery({ queryKey: libraryKeys.list(), queryFn: fetchLibrary });
}

export function useUserGame(userGameId: string) {
  return useQuery({
    queryKey: libraryKeys.detail(userGameId),
    queryFn: () => fetchUserGame(userGameId),
  });
}

/** Global platform list: reference data that doesn't change while the app runs. */
export function usePlatforms() {
  return useQuery({ queryKey: ['platforms'], queryFn: fetchPlatforms, staleTime: Infinity });
}

export function useCatalogSearch(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: ['catalog', 'search', trimmed.toLowerCase()],
    queryFn: () => searchCatalog(trimmed),
    enabled: trimmed.length >= SEARCH_MIN_LENGTH,
    staleTime: 5 * 60_000,
  });
}

export function useAddUserGame() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addUserGame,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: libraryKeys.all }),
  });
}
