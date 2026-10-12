/** Games with less Steam playtime aren't imported (decision #78); a later sync adds them. */
export const STEAM_MIN_IMPORT_MINUTES = 60;
/** Automatic syncs (on opening "Mis juegos") only run if the last one is older. */
export const STEAM_AUTO_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;
/** Minimum time between manual syncs. */
export const STEAM_SYNC_COOLDOWN_MS = 5 * 60 * 1000;
/** A sync still "running" after this long is considered dead (e.g. a server restart). */
export const STEAM_SYNC_STALE_MS = 15 * 60 * 1000;
/** Steam games whose achievements are synced at the same time. */
export const STEAM_SYNC_CONCURRENCY = 4;

/** Steam's portrait cover of a game (also stored for manual games). */
export const STEAM_COVER_URL = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps';

export function steamCoverUrl(appId: number): string {
  return `${STEAM_COVER_URL}/${appId}/library_600x900.jpg`;
}

export enum SteamErrorCode {
  NotConfigured = 'STEAM_NOT_CONFIGURED',
  NotLinked = 'STEAM_NOT_LINKED',
  AccountInUse = 'STEAM_ACCOUNT_IN_USE',
  SyncCooldown = 'STEAM_SYNC_COOLDOWN',
  SyncRunning = 'STEAM_SYNC_RUNNING',
  /** Sync failures, stored in the account. */
  PrivateProfile = 'PRIVATE_PROFILE',
  SteamUnavailable = 'STEAM_UNAVAILABLE',
  CatalogUnavailable = 'CATALOG_UNAVAILABLE',
}
