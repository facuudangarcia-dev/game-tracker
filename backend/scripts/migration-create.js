// Creates an empty migration: npm run migration:create -- <Name>
const { runTypeormMigrationCommand } = require('./typeorm-migration');

runTypeormMigrationCommand('migration:create', { needsDataSource: false });
