import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

export interface TestApp {
  app: INestApplication<App>;
  dataSource: DataSource;
  /** Empties all application tables (keeps the migrations table). */
  resetDatabase: () => Promise<void>;
}

export async function createTestApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configureApp(app);
  await app.init();

  const dataSource = app.get(DataSource);
  const resetDatabase = async () => {
    const tables = dataSource.entityMetadatas.map((meta) => `"${meta.tableName}"`).join(', ');
    if (tables) {
      await dataSource.query(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
    }
  };

  return { app, dataSource, resetDatabase };
}
