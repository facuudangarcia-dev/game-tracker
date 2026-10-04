import { describe, expect, it } from 'vitest';
import { validateCredentials } from './validation';

describe('validateCredentials', () => {
  it('accepts valid register credentials', () => {
    expect(validateCredentials({ email: 'a@b.co', password: '12345678' }, 'register')).toEqual({});
  });

  it('requires both fields', () => {
    const errors = validateCredentials({ email: ' ', password: '' }, 'login');

    expect(errors.email).toBeDefined();
    expect(errors.password).toBeDefined();
  });

  it('rejects malformed emails', () => {
    expect(validateCredentials({ email: 'nope', password: 'x' }, 'login').email).toBeDefined();
  });

  it('enforces the minimum length only when registering', () => {
    expect(validateCredentials({ email: 'a@b.co', password: 'short' }, 'register').password).toBe(
      'La contraseña debe tener al menos 8 caracteres.',
    );
    expect(validateCredentials({ email: 'a@b.co', password: 'short' }, 'login')).toEqual({});
  });

  it('enforces the maximum length', () => {
    const password = 'x'.repeat(129);

    expect(validateCredentials({ email: 'a@b.co', password }, 'login').password).toBeDefined();
  });
});
