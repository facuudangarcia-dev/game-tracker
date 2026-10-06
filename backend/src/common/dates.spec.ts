import { isFutureDate, isFutureTimestamp, latestAllowedDate } from './dates';

describe('dates', () => {
  // 2026-10-06 20:00 UTC: already 2026-10-07 in UTC+14.
  const now = new Date('2026-10-06T20:00:00Z');

  it('allows "today" in the most advanced time zone', () => {
    expect(latestAllowedDate(now)).toBe('2026-10-07');
    expect(isFutureDate('2026-10-06', now)).toBe(false);
    expect(isFutureDate('2026-10-07', now)).toBe(false);
    expect(isFutureDate('2026-10-08', now)).toBe(true);
  });

  it('tolerates small clock skew for timestamps', () => {
    expect(isFutureTimestamp(new Date('2026-10-06T20:04:00Z'), now)).toBe(false);
    expect(isFutureTimestamp(new Date('2026-10-06T20:06:00Z'), now)).toBe(true);
  });
});
