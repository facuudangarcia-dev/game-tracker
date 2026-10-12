import type { HttpException } from '@nestjs/common';
import { PlayStatus } from './library.constants';
import { assertValidPlaythroughDates, resolveCompletionDate } from './playthrough-rules';

function codeOf(fn: () => void): string | undefined {
  try {
    fn();
    return undefined;
  } catch (error) {
    return ((error as HttpException).getResponse() as { code: string }).code;
  }
}

describe('playthrough rules', () => {
  const valid = { status: PlayStatus.Pending, startDate: null, completionDate: null };

  it('accepts consistent states, including a future start date', () => {
    expect(codeOf(() => assertValidPlaythroughDates(valid))).toBeUndefined();
    expect(
      codeOf(() =>
        assertValidPlaythroughDates({
          ...valid,
          status: PlayStatus.InProgress,
          startDate: '2999-01-01',
        }),
      ),
    ).toBeUndefined();
    expect(
      codeOf(() =>
        assertValidPlaythroughDates({
          status: PlayStatus.Completed,
          startDate: '2025-01-01',
          completionDate: '2025-01-01',
        }),
      ),
    ).toBeUndefined();
  });

  it.each([
    [{ status: PlayStatus.Pending, completionDate: '2025-01-01' }, 'COMPLETION_DATE_NOT_ALLOWED'],
    [
      { status: PlayStatus.InProgress, completionDate: '2025-01-01' },
      'COMPLETION_DATE_NOT_ALLOWED',
    ],
    [{ status: PlayStatus.Completed, completionDate: '2999-01-01' }, 'DATE_IN_FUTURE'],
    [
      { status: PlayStatus.Completed, startDate: '2025-02-01', completionDate: '2025-01-31' },
      'COMPLETION_BEFORE_START',
    ],
  ])('rejects %j with %s', (state, code) => {
    expect(codeOf(() => assertValidPlaythroughDates({ ...valid, ...state }))).toBe(code);
  });

  describe('resolveCompletionDate', () => {
    const completed = {
      status: PlayStatus.Completed,
      startDate: '2025-01-01',
      completionDate: '2025-02-01',
    };

    it('clears only the completion date when leaving COMPLETED', () => {
      expect(resolveCompletionDate(completed, { status: PlayStatus.InProgress })).toBeNull();
    });

    it('keeps it while still completed and uses an explicit value when given', () => {
      expect(resolveCompletionDate(completed, {})).toBe('2025-02-01');
      expect(resolveCompletionDate(completed, { completionDate: '2025-03-01' })).toBe('2025-03-01');
    });
  });
});
