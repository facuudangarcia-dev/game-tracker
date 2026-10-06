import { useMutation, useQueryClient } from '@tanstack/react-query';
import { libraryKeys } from '../library/queries';
import type { Difficulty, UserGameDetails } from '../library/types';

/**
 * Mutation on a UserGame whose response is the updated UserGame: the detail
 * cache is replaced with it and the library list is refreshed (derived values
 * like status or time may have changed).
 */
export function useGameMutation<TVariables>(
  userGameId: string,
  mutationFn: (variables: TVariables) => Promise<UserGameDetails>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (details) => {
      queryClient.setQueryData(libraryKeys.detail(userGameId), details);
      void queryClient.invalidateQueries({ queryKey: libraryKeys.list() });
    },
  });
}

/** Mutation returning the difficulty lists of the UserGame. */
export function useDifficultyMutation<TVariables>(
  userGameId: string,
  mutationFn: (variables: TVariables) => Promise<Difficulty[]>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (difficulties) => {
      queryClient.setQueryData<UserGameDetails>(libraryKeys.detail(userGameId), (current) =>
        current ? { ...current, difficulties } : current,
      );
    },
  });
}
