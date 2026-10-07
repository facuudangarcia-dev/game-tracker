import { dateFormat } from '../../i18n/locale';
import type { CatalogHighlight } from '../library/types';

const DAY: Intl.DateTimeFormatOptions = { day: '2-digit', timeZone: 'UTC' };
const MONTH: Intl.DateTimeFormatOptions = { month: 'short', timeZone: 'UTC' };
const LONG: Intl.DateTimeFormatOptions = { dateStyle: 'long', timeZone: 'UTC' };

/** Parts of a calendar date ("YYYY-MM-DD") for the "calendar page" badge. */
export function calendarParts(isoDate: string) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  return {
    day: dateFormat(DAY).format(date),
    month: dateFormat(MONTH).format(date).replace('.', ''),
    year: isoDate.slice(0, 4),
    long: dateFormat(LONG).format(date),
  };
}

/** Short platform list, e.g. "PS5 · PC · +2". */
export function platformsLabel(game: CatalogHighlight, max = 3): string {
  const names = game.platforms.map((p) => p.shortName);
  return names.length > max
    ? `${names.slice(0, max).join(' · ')} · +${names.length - max}`
    : names.join(' · ');
}

/**
 * Picks the hero game: one with artwork, chosen with `seed` (a random number
 * fixed per visit), so the background varies between visits but not on re-renders.
 */
export function pickFeatured(games: CatalogHighlight[], seed: number): CatalogHighlight | null {
  const candidates = games.filter((game) => game.artworkUrl);
  return candidates.length > 0
    ? candidates[Math.min(Math.floor(seed * candidates.length), candidates.length - 1)]
    : null;
}
