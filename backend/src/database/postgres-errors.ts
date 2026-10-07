import { QueryFailedError } from 'typeorm';

const PG_UNIQUE_VIOLATION = '23505';

export function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error.driverError as { code?: string } | undefined)?.code === PG_UNIQUE_VIOLATION
  );
}

/** Name of the unique constraint/index violated by `error`, if it is a unique violation. */
export function violatedUniqueConstraint(error: unknown): string | undefined {
  return isUniqueViolation(error)
    ? ((error as QueryFailedError).driverError as { constraint?: string }).constraint
    : undefined;
}

/** Escapes LIKE/ILIKE wildcards so user input is matched literally. */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}
