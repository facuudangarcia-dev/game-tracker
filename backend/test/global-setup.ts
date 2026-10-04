import { createDataSource } from '../src/database/data-source';
import { useTestDatabase } from './test-database';

/**
 * Rebuilds the e2e test database from scratch using the migrations, which also
 * verifies that the migrations are reproducible.
 */
export default async function globalSetup(): Promise<void> {
  const dataSource = createDataSource(useTestDatabase());

  await dataSource.initialize();
  try {
    await dataSource.dropDatabase();
    await dataSource.runMigrations({ transaction: 'each' });
  } finally {
    await dataSource.destroy();
  }
}
