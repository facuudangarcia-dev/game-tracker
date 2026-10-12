/** Minimum length of a username search (decision #84). */
export const USER_SEARCH_MIN_LENGTH = 3;
export const USER_SEARCH_MAX_LENGTH = 30;
/** Results of a username search. */
export const USER_SEARCH_LIMIT = 20;

export enum SocialErrorCode {
  UserNotFound = 'USER_NOT_FOUND',
  CannotAddSelf = 'CANNOT_ADD_SELF',
  CannotBlockSelf = 'CANNOT_BLOCK_SELF',
  CannotReportSelf = 'CANNOT_REPORT_SELF',
  RequestNotFound = 'FRIEND_REQUEST_NOT_FOUND',
  NotFriends = 'NOT_FRIENDS',
  NotBlocked = 'NOT_BLOCKED',
  /** A friend who chose "Solo yo": their profile and activity are hidden. */
  ProfilePrivate = 'PROFILE_PRIVATE',
}

/**
 * Per-minute limit of a social route: the given base, or the configured auth limit
 * when it's higher (tests and previews raise it; production keeps the base).
 */
export function socialRateLimit(base: number): () => number {
  return () => Math.max(base, Number(process.env.AUTH_RATE_LIMIT_PER_MINUTE) || 0);
}
