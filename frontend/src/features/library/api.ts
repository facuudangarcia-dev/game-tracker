import { apiFetch } from '../../lib/api/client';
import type {
  AddUserGameInput,
  CatalogSearchResponse,
  Platform,
  UserGameDetails,
  UserGameListItem,
} from './types';

export function fetchLibrary(): Promise<UserGameListItem[]> {
  return apiFetch<UserGameListItem[]>('/library');
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
