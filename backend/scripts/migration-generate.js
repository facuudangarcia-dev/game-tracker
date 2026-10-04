// Generates a migration from entity changes: npm run migration:generate -- <Name>
const { runTypeormMigrationCommand } = require('./typeorm-migration');

runTypeormMigrationCommand('migration:generate', { needsDataSource: true });
