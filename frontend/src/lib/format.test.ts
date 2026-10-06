import { describe, expect, it } from 'vitest';
import { formatDate, formatMinutes, formatYear } from './format';

describe('format', () => {
  it.each([
    [0, '0 min'],
    [45, '45 min'],
    [60, '1 h'],
    [872, '14 h 32 min'],
    [6000, '100 h'],
  ])('formats %i minutes as %s', (minutes, expected) => {
    expect(formatMinutes(minutes)).toBe(expected);
  });

  it('formats calendar dates without time zone shifts', () => {
    expect(formatDate('2026-01-01')).toBe('01/01/2026');
    expect(formatDate(null)).toBe('—');
  });

  it('extracts the year', () => {
    expect(formatYear('2015-05-19')).toBe('2015');
    expect(formatYear(null)).toBeNull();
  });
});
