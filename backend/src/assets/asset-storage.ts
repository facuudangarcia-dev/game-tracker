/**
 * Storage for binary assets (game covers). The app only depends on this
 * interface; the local implementation is used in development and can be
 * replaced by S3 or similar without touching callers (docs/decisions.md #15).
 */
export interface AssetStorage {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<StoredAsset | null>;
  delete(key: string): Promise<void>;
}

export interface StoredAsset {
  data: Buffer;
  contentType: string;
}

export const ASSET_STORAGE = Symbol('ASSET_STORAGE');

export enum AssetStorageDriver {
  Local = 'local',
}

const CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const EXTENSION_CONTENT_TYPES: Record<string, string> = Object.fromEntries(
  Object.entries(CONTENT_TYPE_EXTENSIONS).map(([type, ext]) => [ext, type]),
);

/** Keys look like "covers/<hash>.jpg": no dots in folders, no traversal possible. */
const ASSET_KEY_PATTERN = /^[a-z0-9-]+\/[a-z0-9-]+\.(jpg|png|webp)$/;

export function isValidAssetKey(key: string): boolean {
  return ASSET_KEY_PATTERN.test(key);
}

export function extensionForContentType(contentType: string): string | null {
  return CONTENT_TYPE_EXTENSIONS[contentType.split(';')[0].trim().toLowerCase()] ?? null;
}

export function contentTypeForKey(key: string): string | null {
  const extension = key.split('.').pop() ?? '';
  return EXTENSION_CONTENT_TYPES[extension] ?? null;
}
