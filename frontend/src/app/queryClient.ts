import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import type { User } from '../features/auth/api';
import { currentUserQueryKey } from '../features/auth/queryKeys';
import { ApiError } from '../lib/api/client';

export function createQueryClient(): QueryClient {
  // Any 401 means the session ended (expired or revoked): mark the user as logged
  // out so the route guards send them to /login.
  const handleError = (error: unknown) => {
    if (error instanceof ApiError && error.status === 401) {
      queryClient.setQueryData<User | null>(currentUserQueryKey, null);
    }
  };

  const queryClient: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError: handleError }),
    mutationCache: new MutationCache({ onError: handleError }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status < 500) && failureCount < 1,
        refetchOnWindowFocus: false,
      },
    },
  });
  return queryClient;
}
