import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { CatalogDetailsService } from '../src/catalog/catalog-details.service';
import { CatalogSearchService } from '../src/catalog/catalog-search.service';
import { GAME_CATALOG_PROVIDER } from '../src/catalog/game-catalog-provider';
import { FakeCatalogProvider } from './fake-catalog-provider';

/** Seeded by migrations; tests must never truncate them. */
const REFERENCE_TABLES = new Set([
  'platforms',
  'platform_external_ids',
  'genres',
  'genre_external_ids',
]);

export interface TestApp {
  app: INestApplication<App>;
  dataSource: DataSource;
  /** Replaces the real IGDB provider: e2e tests never call external services. */
  catalog: FakeCatalogProvider;
  /** Empties all user/catalog data, keeping the reference data seeded by migrations. */
  resetDatabase: () => Promise<void>;
}

export async function createTestApp(): Promise<TestApp> {
  const catalog = new FakeCatalogProvider();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(GAME_CATALOG_PROVIDER)
    .useValue(catalog)
    .compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configureApp(app);
  await app.init();

  const dataSource = app.get(DataSource);
  const resetDatabase = async () => {
    const tables = dataSource.entityMetadatas
      .filter((meta) => meta.tableType !== 'view')
      .map((meta) => meta.tableName)
      .filter((table) => !REFERENCE_TABLES.has(table))
      .map((table) => `"${table}"`)
      .join(', ');
    if (tables) {
      await dataSource.query(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
    }
    // Genres created by imports (unknown to the seed) are not reference data.
    await dataSource.query(`DELETE FROM "genres" WHERE "slug" LIKE 'igdb-%'`);
    catalog.reset();
    app.get(CatalogSearchService).clearCache();
    app.get(CatalogDetailsService).clearCache();
  };

  return { app, dataSource, catalog, resetDatabase };
}
