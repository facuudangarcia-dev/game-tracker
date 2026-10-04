import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api/client';

export interface ApiHealth {
  status: 'ok';
  database: 'up';
}

export const apiHealthQueryKey = ['health'] as const;

/** Technical check of the backend + database (not a business feature). */
export function useApiHealth() {
  return useQuery({
    queryKey: apiHealthQueryKey,
    queryFn: () => apiFetch<ApiHealth>('/health'),
    retry: false,
  });
}
