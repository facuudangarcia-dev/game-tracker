import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { useTestDatabase } from './test-database';

// Runs in every e2e test worker before the test files are loaded.
useTestDatabase();

// Tests log in many times from the same IP; rate limiting is not under test here.
process.env.AUTH_RATE_LIMIT_PER_MINUTE = '1000';

// Stored covers go to a throwaway directory, never to the development storage.
process.env.ASSET_STORAGE_LOCAL_DIR = join(tmpdir(), `game-tracker-e2e-assets-${process.pid}`);

// Real credentials (if any) must never be used by tests.
process.env.IGDB_CLIENT_ID = '';
process.env.IGDB_CLIENT_SECRET = '';
// Emails go to MockEmailService; the real Resend key must never be loaded.
process.env.RESEND_API_KEY = '';
process.env.EMAIL_FROM = '';
