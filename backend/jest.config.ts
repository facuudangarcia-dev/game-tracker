import type { Config } from 'jest';

// Unit tests: *.spec.ts files next to the code under src/.
const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  roots: ['<rootDir>/src'],
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['src/**/*.(t|j)s', '!src/main.ts', '!src/database/migrations/**'],
  coverageDirectory: './coverage',
  setupFiles: ['reflect-metadata'],
  testEnvironment: 'node',
};

export default config;
