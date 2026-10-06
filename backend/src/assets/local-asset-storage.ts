import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  type AssetStorage,
  contentTypeForKey,
  isValidAssetKey,
  type StoredAsset,
} from './asset-storage';

/** Stores assets as files under a base directory (development / single server). */
export class LocalAssetStorage implements AssetStorage {
  constructor(private readonly baseDir: string) {}

  // The content type is implied by the key extension for local files.
  async put(key: string, data: Buffer, _contentType: string): Promise<void> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    // Write then rename, so readers never see a half-written file.
    const tempPath = `${path}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tempPath, data);
    await rename(tempPath, path);
  }

  async get(key: string): Promise<StoredAsset | null> {
    const contentType = contentTypeForKey(key);
    if (!isValidAssetKey(key) || !contentType) {
      return null;
    }
    try {
      return { data: await readFile(this.pathFor(key)), contentType };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  private pathFor(key: string): string {
    if (!isValidAssetKey(key)) {
      throw new Error(`Invalid asset key: ${key}`);
    }
    return join(this.baseDir, ...key.split('/'));
  }
}
