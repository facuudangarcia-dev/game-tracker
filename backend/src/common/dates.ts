/**
 * Calendar dates (YYYY-MM-DD, no time zone). "Today" depends on where the user
 * is, so the latest valid day is today in the most advanced time zone (UTC+14):
 * no user can be rejected for entering their own local "today".
 */
const LATEST_TIME_ZONE_OFFSET_MS = 14 * 60 * 60 * 1000;

export function latestAllowedDate(now: Date = new Date()): string {
  return new Date(now.getTime() + LATEST_TIME_ZONE_OFFSET_MS).toISOString().slice(0, 10);
}

/** True for a calendar date after "today" anywhere on Earth. */
export function isFutureDate(isoDate: string, now: Date = new Date()): boolean {
  return isoDate > latestAllowedDate(now);
}

/** Tolerance for timestamps (e.g. sessions) against small client/server clock skew. */
export const CLOCK_SKEW_TOLERANCE_MS = 5 * 60 * 1000;

export function isFutureTimestamp(value: Date, now: Date = new Date()): boolean {
  return value.getTime() > now.getTime() + CLOCK_SKEW_TOLERANCE_MS;
}
