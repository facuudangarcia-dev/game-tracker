import { dateFormat } from '../i18n/locale';

/** Date helpers in the user's local time (inputs) and ISO (API). */

const pad = (n: number) => String(n).padStart(2, '0');

/** Today's calendar date in the user's local time zone: "YYYY-MM-DD". */
export function todayLocal(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Value for <input type="datetime-local">: "YYYY-MM-DDTHH:mm" in local time. */
export function toDateTimeLocalInput(date: Date = new Date()): string {
  return `${todayLocal(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Local "YYYY-MM-DDTHH:mm" → ISO timestamp (UTC) for the API. */
export function dateTimeLocalInputToIso(value: string): string {
  return new Date(value).toISOString();
}

const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

/** ISO timestamp → "06/10/2026, 21:30" in local time. */
export function formatDateTime(iso: string): string {
  return dateFormat(DATE_TIME_OPTIONS).format(new Date(iso));
}
