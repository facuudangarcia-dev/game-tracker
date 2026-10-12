/** A player's profile (decision #85). */
export function playerPath(username: string): string {
  return `/u/${encodeURIComponent(username)}`;
}

/** A game in a player's library, read-only. */
export function playerGamePath(username: string, userGameId: string): string {
  return `${playerPath(username)}/games/${userGameId}`;
}
