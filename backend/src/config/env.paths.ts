import { join } from 'node:path';

// The single .env file lives at the repository root (shared with docker-compose).
// Same depth from src/config and dist/config, so this works in dev and in builds.
export const ROOT_ENV_FILE = join(__dirname, '..', '..', '..', '.env');
