import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssetsModule } from '../assets/assets.module';
import type { EnvironmentVariables } from '../config/env.validation';
import { Game } from '../games/game.entity';
import { GenresModule } from '../genres/genres.module';
import { PlatformsModule } from '../platforms/platforms.module';
import { CatalogCardsService } from './catalog-cards.service';
import { CatalogDetailsService } from './catalog-details.service';
import { CatalogDiscoverService } from './catalog-discover.service';
import { CatalogHighlightsService } from './catalog-highlights.service';
import { CatalogImportService } from './catalog-import.service';
import { CatalogProvider } from './catalog-provider';
import { CatalogReleasesService } from './catalog-releases.service';
import { CatalogSearchService } from './catalog-search.service';
import { CatalogController } from './catalog.controller';
import { GAME_CATALOG_PROVIDER, type GameCatalogProvider } from './game-catalog-provider';
import { IgdbClient } from './igdb/igdb-client';
import { IgdbProvider } from './igdb/igdb.provider';

function createCatalogProvider(
  config: ConfigService<EnvironmentVariables, true>,
): GameCatalogProvider {
  const provider = config.get('CATALOG_PROVIDER', { infer: true });
  switch (provider) {
    case CatalogProvider.Igdb: {
      const clientId = config.get('IGDB_CLIENT_ID', { infer: true })?.trim();
      const clientSecret = config.get('IGDB_CLIENT_SECRET', { infer: true })?.trim();
      const credentials = clientId && clientSecret ? { clientId, clientSecret } : null;
      if (!credentials) {
        new Logger('CatalogModule').warn(
          'IGDB credentials not configured: catalog search will only return local results',
        );
      }
      return new IgdbProvider(new IgdbClient(credentials));
    }
    default:
      throw new Error(`Unsupported CATALOG_PROVIDER: ${String(provider)}`);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Game]), AssetsModule, PlatformsModule, GenresModule],
  controllers: [CatalogController],
  providers: [
    { provide: GAME_CATALOG_PROVIDER, inject: [ConfigService], useFactory: createCatalogProvider },
    CatalogSearchService,
    CatalogImportService,
    CatalogDetailsService,
    CatalogHighlightsService,
    CatalogCardsService,
    CatalogDiscoverService,
    CatalogReleasesService,
  ],
  exports: [
    GAME_CATALOG_PROVIDER,
    CatalogImportService,
    CatalogCardsService,
    CatalogDetailsService,
  ],
})
export class CatalogModule {}
