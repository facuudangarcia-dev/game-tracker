import { describe, expect, it } from 'vitest';
import { validateCredentials, validateRegistration, validateVerificationCode } from './validation';

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

describe('validateRegistration', () => {
  const valid = {
    username: 'Player_1',
    email: 'a@b.co',
    password: '12345678',
    acceptLegal: true,
  };

  it('accepts a valid registration', () => {
    expect(validateRegistration(valid)).toEqual({});
  });

  it.each([
    ['', 'Ingresá un username.'],
    ['ab', 'Entre 3 y 30 caracteres.'],
    ['a'.repeat(31), 'Entre 3 y 30 caracteres.'],
    ['player one', 'Solo letras, números y guión bajo (_).'],
    ['jugadór', 'Solo letras, números y guión bajo (_).'],
  ])('rejects the username %p', (username, message) => {
    expect(validateRegistration({ ...valid, username }).username).toBe(message);
  });

  it('requires accepting the legal documents', () => {
    expect(validateRegistration({ ...valid, acceptLegal: false }).acceptLegal).toBeDefined();
  });
});

describe('validateVerificationCode', () => {
  it.each([['123456'], [' 000000 ']])('accepts %p', (code) => {
    expect(validateVerificationCode(code)).toBeUndefined();
  });

  it.each([['12345'], ['1234567'], ['12345a'], ['']])('rejects %p', (code) => {
    expect(validateVerificationCode(code)).toBeDefined();
  });
});
