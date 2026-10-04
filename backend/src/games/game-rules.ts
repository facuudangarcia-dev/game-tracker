import type { Game } from './game.entity';

/** Catalog games are visible to everyone; manual games only to their creator (decision #24). */
export function isGameVisibleTo(game: Pick<Game, 'createdByUserId'>, userId: string): boolean {
  return game.createdByUserId === null || game.createdByUserId === userId;
}

/**
 * Whether a user may register the game on a platform: catalog games only on the
 * platforms the catalog reports (decision #22); manual games on any (decision #24).
 */
export function isPlatformAllowedForGame(
  game: Pick<Game, 'createdByUserId' | 'platforms'>,
  platformId: string,
): boolean {
  if (game.createdByUserId !== null) {
    return true;
  }
  return game.platforms.some((platform) => platform.id === platformId);
}
