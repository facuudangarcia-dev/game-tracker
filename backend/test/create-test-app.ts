import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

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
  /** Empties all user/catalog data, keeping the reference data seeded by migrations. */
  resetDatabase: () => Promise<void>;
}

export async function createTestApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configureApp(app);
  await app.init();

  const dataSource = app.get(DataSource);
  const resetDatabase = async () => {
    const tables = dataSource.entityMetadatas
      .map((meta) => meta.tableName)
      .filter((table) => !REFERENCE_TABLES.has(table))
      .map((table) => `"${table}"`)
      .join(', ');
    if (tables) {
      await dataSource.query(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
    }
  };

  return { app, dataSource, resetDatabase };
}
