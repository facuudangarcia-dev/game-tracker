import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extensionForContentType, isValidAssetKey } from './asset-storage';
import { LocalAssetStorage } from './local-asset-storage';

describe('LocalAssetStorage', () => {
  let baseDir: string;
  let storage: LocalAssetStorage;

  beforeEach(async () => {
    baseDir = await mkdtemp(join(tmpdir(), 'gt-assets-'));
    storage = new LocalAssetStorage(baseDir);
  });

  afterEach(async () => {
    await rm(baseDir, { recursive: true, force: true });
  });

  it('stores, reads and deletes an asset', async () => {
    const data = Buffer.from([0xff, 0xd8, 0xff]);

    await storage.put('covers/abc123.jpg', data, 'image/jpeg');
    await expect(storage.get('covers/abc123.jpg')).resolves.toEqual({
      data,
      contentType: 'image/jpeg',
    });

    await storage.delete('covers/abc123.jpg');
    await expect(storage.get('covers/abc123.jpg')).resolves.toBeNull();
  });

  it('returns null for missing assets', async () => {
    await expect(storage.get('covers/missing.jpg')).resolves.toBeNull();
  });

  it.each(['../secret.jpg', 'covers/../../etc.jpg', 'covers/a.exe', '/abs/a.jpg', 'a.jpg'])(
    'refuses unsafe key %s',
    async (key) => {
      expect(isValidAssetKey(key)).toBe(false);
      await expect(storage.put(key, Buffer.from('x'), 'image/jpeg')).rejects.toThrow(
        /Invalid asset key/,
      );
      await expect(storage.get(key)).resolves.toBeNull();
    },
  );

  it('maps content types to extensions', () => {
    expect(extensionForContentType('image/jpeg')).toBe('jpg');
    expect(extensionForContentType('image/png; charset=binary')).toBe('png');
    expect(extensionForContentType('text/html')).toBeNull();
  });
});
