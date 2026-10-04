import { useTestDatabase } from './test-database';

// Runs in every e2e test worker before the test files are loaded.
useTestDatabase();

// Tests log in many times from the same IP; rate limiting is not under test here.
process.env.AUTH_RATE_LIMIT_PER_MINUTE = '1000';
