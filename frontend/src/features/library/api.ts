import { apiFetch } from '../../lib/api/client';
import type {
  AddUserGameInput,
  CatalogSearchResponse,
  Genre,
  LibraryFilters,
  Platform,
  UserGameDetails,
  UserGameListItem,
} from './types';

export function fetchLibrary(filters: LibraryFilters = {}): Promise<UserGameListItem[]> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  }
  const query = params.toString();
  return apiFetch<UserGameListItem[]>(query ? `/library?${query}` : '/library');
}

export function fetchGenres(): Promise<Genre[]> {
  return apiFetch<Genre[]>('/genres');
}

export function fetchUserGame(userGameId: string): Promise<UserGameDetails> {
  return apiFetch<UserGameDetails>(`/library/${userGameId}`);
}

export function addUserGame(input: AddUserGameInput): Promise<UserGameDetails> {
  return apiFetch<UserGameDetails>('/library', { method: 'POST', body: JSON.stringify(input) });
}

export function fetchPlatforms(): Promise<Platform[]> {
  return apiFetch<Platform[]>('/platforms');
}

export function searchCatalog(query: string): Promise<CatalogSearchResponse> {
  return apiFetch<CatalogSearchResponse>(`/catalog/search?q=${encodeURIComponent(query)}`);
}
