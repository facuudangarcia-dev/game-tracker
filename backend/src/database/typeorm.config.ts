import { join } from 'node:path';
import type { DataSourceOptions } from 'typeorm';

export interface DatabaseEnv {
  POSTGRES_HOST: string;
  POSTGRES_PORT: number;
  POSTGRES_USER: string;
  POSTGRES_PASSWORD: string;
  POSTGRES_DB: string;
}

/**
 * Shared TypeORM options for the Nest app and the migrations CLI.
 * The schema is managed exclusively through migrations: synchronize is always false.
 */
export function buildDataSourceOptions(env: DatabaseEnv): DataSourceOptions {
  return {
    type: 'postgres',
    host: env.POSTGRES_HOST,
    port: env.POSTGRES_PORT,
    username: env.POSTGRES_USER,
    password: env.POSTGRES_PASSWORD,
    database: env.POSTGRES_DB,
    synchronize: false,
    // gen_random_uuid() is built into PostgreSQL 13+; no uuid-ossp extension needed.
    uuidExtension: 'pgcrypto',
    migrationsRun: false,
    migrationsTableName: 'migrations',
    entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
    migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  };
}
