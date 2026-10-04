import { NodeEnv, validateEnv } from './env.validation';

const validEnv = {
  NODE_ENV: 'test',
  BACKEND_PORT: '3000',
  FRONTEND_ORIGIN: 'http://localhost:5173',
  POSTGRES_HOST: 'localhost',
  POSTGRES_PORT: '5432',
  POSTGRES_USER: 'user',
  POSTGRES_PASSWORD: 'password',
  POSTGRES_DB: 'db',
  AUTH_SECRET: 'x'.repeat(32),
};

describe('validateEnv', () => {
  it('accepts a valid configuration and converts numeric values', () => {
    const env = validateEnv(validEnv);

    expect(env.NODE_ENV).toBe(NodeEnv.Test);
    expect(env.POSTGRES_PORT).toBe(5432);
    expect(env.AUTH_COOKIE_NAME).toBe('gt_session');
  });

  it('rejects a missing required variable', () => {
    const { POSTGRES_DB: _omitted, ...withoutDb } = validEnv;

    expect(() => validateEnv(withoutDb)).toThrow(/POSTGRES_DB/);
  });

  it('rejects an AUTH_SECRET that is too short', () => {
    expect(() => validateEnv({ ...validEnv, AUTH_SECRET: 'short' })).toThrow(/AUTH_SECRET/);
  });
});
