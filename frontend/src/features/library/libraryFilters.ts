import type { LibraryFilters, LibrarySortField, PlayStatus, SortOrder } from './types';

export const SORT_FIELDS: LibrarySortField[] = [
  'createdAt',
  'name',
  'totalMinutes',
  'rating',
  'startDate',
  'completionDate',
];
export const STATUSES: PlayStatus[] = ['PENDING', 'IN_PROGRESS', 'COMPLETED'];
export const DEFAULT_SORT: LibrarySortField = 'createdAt';

/** Natural default direction per field (newest / most / best first, names A-Z). */
export function defaultOrder(sort: LibrarySortField): SortOrder {
  return sort === 'name' ? 'asc' : 'desc';
}

const pick = <T extends string>(value: string | null, allowed: readonly T[]): T | undefined =>
  value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;

/** Reads filters from the URL, ignoring invalid values. */
export function filtersFromParams(params: URLSearchParams): LibraryFilters {
  const sort = pick(params.get('sort'), SORT_FIELDS);
  return {
    search: params.get('search')?.trim() || undefined,
    status: pick(params.get('status'), STATUSES),
    platformId: params.get('platformId') || undefined,
    genreId: params.get('genreId') || undefined,
    platinum: pick(params.get('platinum'), ['true', 'false'] as const),
    sort,
    order: pick(params.get('order'), ['asc', 'desc'] as const),
  };
}

/** Writes filters to the URL, omitting empty values. */
export function paramsFromFilters(filters: LibraryFilters): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      params.set(key, String(value));
    }
  }
  return params;
}

/** True when the list is narrowed (search or filter), not just sorted. */
export function hasActiveFilters(filters: LibraryFilters): boolean {
  return Boolean(
    filters.search || filters.status || filters.platformId || filters.genreId || filters.platinum,
  );
}

/** Number of active narrowing filters (search excluded), for the mobile button badge. */
export function activeFilterCount(filters: LibraryFilters): number {
  return [filters.status, filters.platformId, filters.genreId, filters.platinum].filter(Boolean)
    .length;
}
