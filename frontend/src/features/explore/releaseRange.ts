import { isoDay } from './format';

export type View = 'recent' | 'week' | 'month' | 'quarter';
export const VIEWS: View[] = ['recent', 'week', 'month', 'quarter'];
export const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/** Inclusive date range of a view, moved `offset` periods from today. */
export function releaseRange(
  view: View,
  offset: number,
  month: string | null,
  today = new Date(),
): { from: string; to: string } {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  switch (view) {
    case 'recent': {
      const to = addDays(start, -1 + offset * 30);
      return { from: isoDay(addDays(to, -29)), to: isoDay(to) };
    }
    case 'month': {
      const [year, monthIndex] =
        month && MONTH_PATTERN.test(month)
          ? [Number(month.slice(0, 4)), Number(month.slice(5)) - 1]
          : [start.getFullYear(), start.getMonth()];
      return {
        from: isoDay(new Date(year, monthIndex, 1)),
        to: isoDay(new Date(year, monthIndex + 1, 0)),
      };
    }
    case 'quarter': {
      const first = new Date(start.getFullYear(), start.getMonth() + offset * 3, 1);
      return {
        from: isoDay(first),
        to: isoDay(new Date(first.getFullYear(), first.getMonth() + 3, 0)),
      };
    }
    default: {
      const from = addDays(start, offset * 7);
      return { from: isoDay(from), to: isoDay(addDays(from, 6)) };
    }
  }
}
