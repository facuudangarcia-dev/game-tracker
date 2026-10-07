import { Controller, Get, Inject, NotFoundException, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../auth/decorators';
import { ASSET_STORAGE, type AssetStorage } from './asset-storage';

/** Folders served publicly. Avatars are personal and go through /api/profile only. */
const PUBLIC_FOLDERS = new Set(['covers']);

/**
 * Serves stored assets. Public: covers are catalog images, not personal data.
 * Keys are content-addressed (hash in the name), so responses are immutable.
 */
@Public()
@Controller('assets')
export class AssetsController {
  constructor(@Inject(ASSET_STORAGE) private readonly storage: AssetStorage) {}

  @Get(':folder/:file')
  async get(
    @Param('folder') folder: string,
    @Param('file') file: string,
    @Res() response: Response,
  ): Promise<void> {
    if (!PUBLIC_FOLDERS.has(folder)) {
      throw new NotFoundException();
    }
    const asset = await this.storage.get(`${folder}/${file}`);
    if (!asset) {
      throw new NotFoundException();
    }
    response
      .status(200)
      .type(asset.contentType)
      .set('Cache-Control', 'public, max-age=31536000, immutable')
      .send(asset.data);
  }
}
