// Cross-platform wrapper so migration names can be passed as a plain argument
// (the TypeORM CLI expects a full file path).
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const MIGRATIONS_DIR = 'src/database/migrations';
const DATA_SOURCE = 'src/database/data-source.ts';

function runTypeormMigrationCommand(command, { needsDataSource }) {
  const name = process.argv[2];
  if (!name || !/^[A-Za-z][A-Za-z0-9]*$/.test(name)) {
    console.error(`Usage: npm run ${command} -- <PascalCaseName>`);
    process.exit(1);
  }

  const cli = require.resolve('typeorm/cli-ts-node-commonjs.js', {
    paths: [path.join(__dirname, '..')],
  });
  const args = [cli, command, `${MIGRATIONS_DIR}/${name}`];
  if (needsDataSource) {
    args.push('-d', DATA_SOURCE);
  }

  const result = spawnSync(process.execPath, args, {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
  });
  process.exit(result.status ?? 1);
}

module.exports = { runTypeormMigrationCommand };
