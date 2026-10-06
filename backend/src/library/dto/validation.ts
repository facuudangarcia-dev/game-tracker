import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsISO8601, Matches } from 'class-validator';

/** Calendar date "YYYY-MM-DD" (real date, e.g. no February 30th). */
export function IsCalendarDate() {
  return applyDecorators(
    Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '$property must be a YYYY-MM-DD date' }),
    IsISO8601({ strict: true }),
  );
}

/** Trims strings and turns blank ones into null (optional text fields). */
export function TrimToNull() {
  return Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') {
      return value;
    }
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  });
}

/** Blank notes become null; other text is kept exactly as written. */
export function BlankToNull() {
  return Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim() === '' ? null : value,
  );
}
