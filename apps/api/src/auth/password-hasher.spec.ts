import { describe, it, expect } from 'vitest';

import { ARGON2_PARAMS, PasswordHasher } from './password-hasher';

describe('PasswordHasher', () => {
  const hasher = new PasswordHasher();

  it('produces an argon2id encoded hash with the OWASP-2024 parameters', async () => {
    const encoded = await hasher.hash('hunter2');
    expect(encoded.startsWith('$argon2id$v=19$')).toBe(true);
    expect(encoded).toContain(`m=${ARGON2_PARAMS.memoryCost}`);
    expect(encoded).toContain(`t=${ARGON2_PARAMS.timeCost}`);
    expect(encoded).toContain(`p=${ARGON2_PARAMS.parallelism}`);
  });

  it('verifies a matching plaintext as true', async () => {
    const encoded = await hasher.hash('correct horse battery staple');
    expect(await hasher.verify('correct horse battery staple', encoded)).toBe(true);
  });

  it('verifies a non-matching plaintext as false', async () => {
    const encoded = await hasher.hash('correct horse battery staple');
    expect(await hasher.verify('wrong password', encoded)).toBe(false);
  });

  it('produces different hashes for the same plaintext (per-hash salt)', async () => {
    const a = await hasher.hash('hunter2');
    const b = await hasher.hash('hunter2');
    expect(a).not.toBe(b);
  });

  it('returns false (does not throw) when the encoded hash is malformed', async () => {
    expect(await hasher.verify('anything', 'not-a-valid-argon2-string')).toBe(false);
  });

  it('exposes ARGON2_PARAMS matching ADR-0007 (OWASP 2024 baseline)', () => {
    expect(ARGON2_PARAMS).toEqual({
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
  });
});
