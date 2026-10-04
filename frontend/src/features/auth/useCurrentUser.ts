import { useQuery } from '@tanstack/react-query';
import { fetchCurrentUser } from './api';
import { currentUserQueryKey } from './queryKeys';

/** The logged-in user (`null` when logged out). Source of truth for auth state in the UI. */
export function useCurrentUser() {
  return useQuery({
    queryKey: currentUserQueryKey,
    queryFn: fetchCurrentUser,
    retry: false,
  });
}
