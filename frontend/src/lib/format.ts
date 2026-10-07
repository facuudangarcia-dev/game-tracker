import { dateFormat } from '../i18n/locale';
import { messages } from '../i18n/messages';

const t = messages.time;

/** Integer minutes → "12 h 30 min", "45 min", "3 h". Time is always stored as minutes. */
export function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) {
    return t.minutes(minutes);
  }
  return minutes === 0 ? t.hours(hours) : t.hoursAndMinutes(hours, minutes);
}

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
};

/** "YYYY-MM-DD" (calendar date, no time zone) → "05/10/2026" (in the current locale). */
export function formatDate(isoDate: string | null): string {
  if (!isoDate) {
    return messages.common.notSet;
  }
  return dateFormat(DATE_OPTIONS).format(new Date(`${isoDate}T00:00:00Z`));
}

export function formatYear(isoDate: string | null): string | null {
  return isoDate ? isoDate.slice(0, 4) : null;
}
