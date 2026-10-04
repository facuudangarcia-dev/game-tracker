import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { ROOT_ENV_FILE } from '../config/env.paths';
import { buildDataSourceOptions } from './typeorm.config';

// Entry point used by the TypeORM CLI (migration:run / generate / revert).
loadEnv({ path: ROOT_ENV_FILE, quiet: true });

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name} (see .env.example)`);
  }
  return value;
}

export function createDataSource(database = required('POSTGRES_DB')): DataSource {
  return new DataSource(
    buildDataSourceOptions({
      POSTGRES_HOST: required('POSTGRES_HOST'),
      POSTGRES_PORT: Number(required('POSTGRES_PORT')),
      POSTGRES_USER: required('POSTGRES_USER'),
      POSTGRES_PASSWORD: required('POSTGRES_PASSWORD'),
      POSTGRES_DB: database,
    }),
  );
}

export default createDataSource();
