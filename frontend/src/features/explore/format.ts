import { dateFormat, intlLocale } from '../../i18n/locale';
import { messages } from '../../i18n/messages';
import type { DatePrecision, Money } from './types';

/** A price in the currency the source reports (never converted). */
export function formatMoney(money: Money): string {
  try {
    return new Intl.NumberFormat(intlLocale(), {
      style: 'currency',
      currency: money.currency,
      // "symbol", not "narrowSymbol": in es-AR a bare "$" reads as pesos (US$ for dollars).
      currencyDisplay: 'symbol',
    }).format(money.amount);
  } catch {
    return `${money.amount.toFixed(2)} ${money.currency}`;
  }
}

/** "10 oct 2026, 14:30" in the current locale. */
export function formatDateTime(iso: string): string {
  return dateFormat({ dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

/** "10 oct 2026". */
export function formatShortDate(iso: string): string {
  return dateFormat({ dateStyle: 'medium' }).format(new Date(iso));
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
];

/** "hace 3 horas" / "3 hours ago"; older than a week: the date. */
export function formatRelative(iso: string, now = Date.now()): string {
  const diff = new Date(iso).getTime() - now;
  if (Math.abs(diff) >= 7 * 86_400_000) {
    return formatShortDate(iso);
  }
  const format = new Intl.RelativeTimeFormat(intlLocale(), { numeric: 'auto' });
  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms) {
      return format.format(Math.round(diff / ms), unit);
    }
  }
  return format.format(0, 'minute');
}

/** Label of an estimated release date ("Diciembre de 2029 (fecha estimada)"). */
export function estimatedDateLabel(date: string, precision: DatePrecision): string {
  const t = messages.releases;
  const year = date.slice(0, 4);
  const parsed = new Date(`${date}T00:00:00Z`);
  if (precision === 'month') {
    const month = dateFormat({ month: 'long', year: 'numeric', timeZone: 'UTC' }).format(parsed);
    return t.estimatedMonth(month.charAt(0).toUpperCase() + month.slice(1));
  }
  if (precision === 'quarter') {
    return t.estimatedQuarter(Math.floor(parsed.getUTCMonth() / 3) + 1, year);
  }
  return t.estimatedYear(year);
}

/** YYYY-MM-DD of a local date. */
export function isoDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
