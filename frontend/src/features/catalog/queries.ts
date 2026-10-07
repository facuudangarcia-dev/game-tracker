import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api/client';
import { SEARCH_MIN_LENGTH, useCatalogSearch } from '../library/queries';
import type { CatalogGame, CatalogSearchResult } from '../library/types';

export const catalogKeys = {
  game: (provider: string, externalId: string) =>
    ['catalog', 'game', provider, externalId] as const,
};

/** Path of the public catalog page of a game. */
export function catalogGamePath(provider: string, externalId: string): string {
  return `/catalog/${provider}/${externalId}`;
}

export function fetchCatalogGame(provider: string, externalId: string): Promise<CatalogGame> {
  return apiFetch<CatalogGame>(
    `/catalog/games/${encodeURIComponent(provider)}/${encodeURIComponent(externalId)}`,
  );
}

export function useCatalogGame(provider: string, externalId: string) {
  return useQuery({
    queryKey: catalogKeys.game(provider, externalId),
    queryFn: () => fetchCatalogGame(provider, externalId),
  });
}

/**
 * Global (header) search: the same catalog search endpoint, limited to catalog
 * games. Manual games are private and never shown here (they have no catalog page).
 */
export function useGlobalCatalogSearch(query: string) {
  const search = useCatalogSearch(query);
  const results: CatalogSearchResult[] = (search.data?.results ?? []).filter(
    (result) => !result.isManual && result.provider !== null && result.externalId !== null,
  );
  return {
    ...search,
    results,
    catalogAvailable: search.data?.catalogAvailable ?? true,
    enabled: query.trim().length >= SEARCH_MIN_LENGTH,
  };
}
