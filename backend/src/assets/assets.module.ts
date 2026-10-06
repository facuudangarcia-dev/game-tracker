import { isAbsolute, join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../config/env.validation';
import { ASSET_STORAGE, type AssetStorage, AssetStorageDriver } from './asset-storage';
import { AssetsController } from './assets.controller';
import { LocalAssetStorage } from './local-asset-storage';

// Relative local paths are resolved from backend/ (same depth from src/assets and dist/assets).
const BACKEND_ROOT = join(__dirname, '..', '..');

@Module({
  controllers: [AssetsController],
  providers: [
    {
      provide: ASSET_STORAGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>): AssetStorage => {
        const driver = config.get('ASSET_STORAGE_DRIVER', { infer: true });
        switch (driver) {
          case AssetStorageDriver.Local: {
            const dir = config.get('ASSET_STORAGE_LOCAL_DIR', { infer: true });
            return new LocalAssetStorage(isAbsolute(dir) ? dir : join(BACKEND_ROOT, dir));
          }
          default:
            throw new Error(`Unsupported ASSET_STORAGE_DRIVER: ${String(driver)}`);
        }
      },
    },
  ],
  exports: [ASSET_STORAGE],
})
export class AssetsModule {}
