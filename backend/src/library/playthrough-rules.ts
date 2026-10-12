import { HttpStatus } from '@nestjs/common';
import { apiError } from '../common/api-error';
import { isFutureDate } from '../common/dates';
import { LibraryErrorCode, PlayStatus } from './library.constants';

export interface PlaythroughDates {
  status: PlayStatus;
  startDate: string | null;
  completionDate: string | null;
}

/**
 * Validates the final state of a playthrough (after applying a change):
 * - only COMPLETED may have a completion date, and it's optional (decision #70);
 * - completion >= start when both exist;
 * - completion can't be in the future (a future start date is allowed).
 * @throws HttpException with a LibraryErrorCode
 */
export function assertValidPlaythroughDates({
  status,
  startDate,
  completionDate,
}: PlaythroughDates) {
  if (status !== PlayStatus.Completed && completionDate) {
    throw apiError(
      HttpStatus.BAD_REQUEST,
      LibraryErrorCode.CompletionDateNotAllowed,
      'Only completed playthroughs have a completion date',
    );
  }
  if (completionDate && isFutureDate(completionDate)) {
    throw apiError(
      HttpStatus.BAD_REQUEST,
      LibraryErrorCode.DateInFuture,
      'The completion date cannot be in the future',
    );
  }
  if (startDate && completionDate && completionDate < startDate) {
    throw apiError(
      HttpStatus.BAD_REQUEST,
      LibraryErrorCode.CompletionBeforeStart,
      'The completion date cannot be before the start date',
    );
  }
}

/**
 * Applies a status change. Leaving COMPLETED clears only the completion date
 * (it would no longer describe the current state); every other field is kept.
 */
export function resolveCompletionDate(
  current: PlaythroughDates,
  change: { status?: PlayStatus; completionDate?: string | null },
): string | null {
  const status = change.status ?? current.status;
  if (change.completionDate !== undefined) {
    return change.completionDate;
  }
  if (status !== PlayStatus.Completed) {
    return null;
  }
  return current.completionDate;
}
