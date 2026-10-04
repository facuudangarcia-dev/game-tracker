import { config as loadEnv } from 'dotenv';
import { ROOT_ENV_FILE } from '../src/config/env.paths';

/**
 * Points the process at the e2e test database (POSTGRES_TEST_DB) so tests never
 * touch the development database. Values already set in process.env take
 * precedence over the .env file.
 */
export function useTestDatabase(): string {
  loadEnv({ path: ROOT_ENV_FILE, quiet: true });

  const testDb = process.env.POSTGRES_TEST_DB;
  if (!testDb) {
    throw new Error('POSTGRES_TEST_DB must be set to run e2e tests (see .env.example)');
  }
  // Remember the original database once: Jest workers inherit the env already
  // rewritten by globalSetup, so POSTGRES_DB alone can't be compared again.
  process.env.E2E_ORIGINAL_POSTGRES_DB ??= process.env.POSTGRES_DB;
  if (testDb === process.env.E2E_ORIGINAL_POSTGRES_DB) {
    throw new Error('POSTGRES_TEST_DB must be different from POSTGRES_DB');
  }

  process.env.NODE_ENV = 'test';
  process.env.POSTGRES_DB = testDb;
  return testDb;
}
