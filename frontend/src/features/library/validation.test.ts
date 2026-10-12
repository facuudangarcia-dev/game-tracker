import { describe, expect, it } from 'vitest';
import { noteError, parseDuration, parseRating, validatePlaythroughDates } from './validation';

describe('library form validation', () => {
  it.each([
    ['', { value: null }],
    ['10', { value: 10 }],
    ['100', { value: 100 }],
  ])('parses rating %p', (input, expected) => {
    expect(parseRating(input)).toEqual(expected);
  });

  it.each(['9', '101', '55.5', 'abc', '-20'])('rejects rating %p', (input) => {
    expect(parseRating(input)).toHaveProperty('error');
  });

  it('limits notes to 5000 characters', () => {
    expect(noteError('x'.repeat(5000))).toBeUndefined();
    expect(noteError('x'.repeat(5001))).toBeDefined();
  });

  it.each([
    ['14', '32', 872],
    ['', '45', 45],
    ['2', '', 120],
    ['1', '60', null],
    ['1.5', '0', null],
    ['-1', '0', null],
  ])('parses %sh %smin as %p', (hours, minutes, expected) => {
    expect(parseDuration(hours, minutes)).toBe(expected);
  });

  it('validates playthrough dates like the backend', () => {
    const today = '2026-10-06';
    expect(validatePlaythroughDates('COMPLETED', '', '', today)).toEqual({});
    expect(validatePlaythroughDates('COMPLETED', '2026-01-01', '', today)).toEqual({});
    expect(
      validatePlaythroughDates('COMPLETED', '', '2026-10-07', today).completionDate,
    ).toBeDefined();
    expect(
      validatePlaythroughDates('COMPLETED', '2026-02-01', '2026-01-01', today).completionDate,
    ).toBeDefined();
    expect(validatePlaythroughDates('COMPLETED', '2026-01-01', '2026-10-06', today)).toEqual({});
    expect(validatePlaythroughDates('IN_PROGRESS', '2999-01-01', '', today)).toEqual({});
  });
});
