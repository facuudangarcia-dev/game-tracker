import type { Config } from 'jest';

// End-to-end tests: boot the full Nest app against the PostgreSQL test database
// (POSTGRES_TEST_DB). Requires `docker compose up -d`.
const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.e2e-spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  setupFiles: ['reflect-metadata', '<rootDir>/setup-env.ts'],
  globalSetup: '<rootDir>/global-setup.ts',
  testEnvironment: 'node',
};

export default config;
