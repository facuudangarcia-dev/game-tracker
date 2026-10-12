import { messages } from '../../i18n/messages';
import { todayLocal } from '../../lib/dates';
import type { PlayStatus } from './types';

/**
 * Limits and rules mirrored from the backend (docs/decisions.md). The backend
 * remains the authority; these give immediate feedback in forms.
 */
export const GAME_NAME_MAX_LENGTH = 255;
export const PLAYTHROUGH_NAME_MAX_LENGTH = 100;
export const DIFFICULTY_NAME_MAX_LENGTH = 100;
export const NOTE_MAX_LENGTH = 5000;
export const RATING_MIN = 10;
export const RATING_MAX = 100;
export const MAX_MINUTES = 1_000_000;
/** Initial difficulty list of every new game (backend DEFAULT_DIFFICULTY_NAMES). */
export const DEFAULT_DIFFICULTY_NAMES = ['Muy fácil', 'Fácil', 'Normal', 'Difícil', 'Muy difícil'];

const v = messages.validation;

/** "" → null (no rating); otherwise an integer 10-100, or an error message. */
export function parseRating(input: string): { value: number | null } | { error: string } {
  const trimmed = input.trim();
  if (trimmed === '') {
    return { value: null };
  }
  const value = Number(trimmed);
  if (!/^\d+$/.test(trimmed) || value < RATING_MIN || value > RATING_MAX) {
    return { error: v.ratingRange(RATING_MIN, RATING_MAX) };
  }
  return { value };
}

export function noteError(note: string): string | undefined {
  return note.length > NOTE_MAX_LENGTH ? v.noteTooLong(NOTE_MAX_LENGTH) : undefined;
}

/** Hours + minutes inputs → integer minutes (minutes 0-59). */
export function parseDuration(hours: string, minutes: string): number | null {
  const h = hours.trim() === '' ? 0 : Number(hours);
  const m = minutes.trim() === '' ? 0 : Number(minutes);
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || m < 0 || m > 59) {
    return null;
  }
  const total = h * 60 + m;
  return total <= MAX_MINUTES ? total : null;
}

export interface PlaythroughFormErrors {
  startDate?: string;
  completionDate?: string;
}

/** Same rules as the backend: the (optional) completion date is not future and >= start. */
export function validatePlaythroughDates(
  status: PlayStatus,
  startDate: string,
  completionDate: string,
  today: string = todayLocal(),
): PlaythroughFormErrors {
  const errors: PlaythroughFormErrors = {};
  if (status === 'COMPLETED') {
    if (completionDate > today) {
      errors.completionDate = v.dateInFuture;
    } else if (startDate && completionDate && completionDate < startDate) {
      errors.completionDate = v.completionBeforeStart;
    }
  }
  return errors;
}
