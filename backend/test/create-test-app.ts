import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getOptionsToken } from '@nestjs/throttler';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { CatalogDetailsService } from '../src/catalog/catalog-details.service';
import { CatalogSearchService } from '../src/catalog/catalog-search.service';
import { GAME_CATALOG_PROVIDER } from '../src/catalog/game-catalog-provider';
import { EmailService } from '../src/email/email.service';
import { FakeCatalogProvider } from './fake-catalog-provider';
import { MockEmailService } from './mock-email-service';

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
  /** Replaces Resend: e2e tests never send real emails. */
  emails: MockEmailService;
  /** Empties all user/catalog data, keeping the reference data seeded by migrations. */
  resetDatabase: () => Promise<void>;
}

export interface TestAppOptions {
  /** Requests allowed per route, IP and minute on the rate-limited auth routes. */
  authRateLimit?: number;
}

export async function createTestApp(options: TestAppOptions = {}): Promise<TestApp> {
  const catalog = new FakeCatalogProvider();
  const emails = new MockEmailService();
  let builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(GAME_CATALOG_PROVIDER)
    .useValue(catalog)
    .overrideProvider(EmailService)
    .useValue(emails);
  if (options.authRateLimit !== undefined) {
    builder = builder
      .overrideProvider(getOptionsToken())
      .useValue([{ ttl: 60_000, limit: options.authRateLimit }]);
  }
  const moduleRef = await builder.compile();
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
    emails.reset();
    app.get(CatalogSearchService).clearCache();
    app.get(CatalogDetailsService).clearCache();
  };

  return { app, dataSource, catalog, emails, resetDatabase };
}
