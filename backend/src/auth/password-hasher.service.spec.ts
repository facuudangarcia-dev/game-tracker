import { PasswordHasher } from './password-hasher.service';

describe('PasswordHasher', () => {
  const hasher = new PasswordHasher();

  it('produces Argon2id hashes that verify only the original password', async () => {
    const hash = await hasher.hash('correct horse battery staple');

    expect(hash.startsWith('$argon2id$')).toBe(true);
    await expect(hasher.verify(hash, 'correct horse battery staple')).resolves.toBe(true);
    await expect(hasher.verify(hash, 'wrong password')).resolves.toBe(false);
  });

  it('returns false instead of throwing for malformed hashes', async () => {
    await expect(hasher.verify('not-a-hash', 'anything')).resolves.toBe(false);
  });

  it('does not require rehashing a hash made with the current parameters', async () => {
    const hash = await hasher.hash('password123');

    expect(hasher.needsRehash(hash)).toBe(false);
  });
});
