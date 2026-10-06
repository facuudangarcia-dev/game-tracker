import type { LibrarySortField, SortOrder } from './dto/list-library.dto';
import type { UserGameListItemDto } from './dto/user-game-response.dto';

export const DEFAULT_SORT: LibrarySortField = 'createdAt';
export const DEFAULT_ORDER: SortOrder = 'desc';

type SortValue = string | number | null;

const VALUE: Record<LibrarySortField, (item: UserGameListItemDto) => SortValue> = {
  name: (item) => item.game.name,
  createdAt: (item) => item.createdAt,
  totalMinutes: (item) => item.totalMinutes,
  rating: (item) => item.rating,
  startDate: (item) => item.startDate,
  completionDate: (item) => item.completionDate,
};

const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

function compareValues(a: SortValue, b: SortValue): number {
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  return collator.compare(String(a), String(b));
}

/**
 * Sorts library items. Items without a value (no rating, never started, not
 * completed...) always go last, in both directions; ties are broken by name
 * and then by id, so the order is stable.
 */
export function sortLibrary(
  items: UserGameListItemDto[],
  sort: LibrarySortField = DEFAULT_SORT,
  order: SortOrder = DEFAULT_ORDER,
): UserGameListItemDto[] {
  const direction = order === 'asc' ? 1 : -1;
  const valueOf = VALUE[sort];

  return [...items].sort((a, b) => {
    const va = valueOf(a);
    const vb = valueOf(b);
    if (va === null || vb === null) {
      if (va !== vb) {
        return va === null ? 1 : -1;
      }
    } else {
      const byValue = compareValues(va, vb) * direction;
      if (byValue !== 0) {
        return byValue;
      }
    }
    return collator.compare(a.game.name, b.game.name) || a.id.localeCompare(b.id);
  });
}
