import { describe, it, expect } from 'vitest';
import {
  emailSchema,
  nameSchema,
  passwordSchema,
  signupBodySchema,
  credentialsVerifyBodySchema,
  forgotPasswordBodySchema,
  resetPasswordBodySchema,
} from './auth.js';

describe('emailSchema', () => {
  it('trims and lowercases the input', () => {
    const result = emailSchema.parse('  ALICE@Example.com  ');
    expect(result).toBe('alice@example.com');
  });

  it('rejects malformed addresses', () => {
    expect(emailSchema.safeParse('not-an-email').success).toBe(false);
  });

  it('rejects emails longer than 254 characters', () => {
    const long = `${'a'.repeat(250)}@x.io`;
    expect(emailSchema.safeParse(long).success).toBe(false);
  });

  it('accepts an email exactly at the 254-character boundary', () => {
    const local = 'a'.repeat(254 - '@example.com'.length);
    const ok = `${local}@example.com`;
    expect(ok.length).toBe(254);
    expect(emailSchema.safeParse(ok).success).toBe(true);
  });
});

describe('nameSchema', () => {
  it('rejects empty after trim', () => {
    expect(nameSchema.safeParse('   ').success).toBe(false);
  });

  it('accepts an 80-character name', () => {
    expect(nameSchema.safeParse('a'.repeat(80)).success).toBe(true);
  });

  it('rejects an 81-character name', () => {
    expect(nameSchema.safeParse('a'.repeat(81)).success).toBe(false);
  });

  it('trims surrounding whitespace', () => {
    expect(nameSchema.parse('  Alice  ')).toBe('Alice');
  });
});

describe('passwordSchema', () => {
  it('rejects 9 chars', () => {
    expect(passwordSchema.safeParse('a'.repeat(9)).success).toBe(false);
  });

  it('accepts 10 chars', () => {
    expect(passwordSchema.safeParse('a'.repeat(10)).success).toBe(true);
  });

  it('accepts 128 chars', () => {
    expect(passwordSchema.safeParse('a'.repeat(128)).success).toBe(true);
  });

  it('rejects 129 chars', () => {
    expect(passwordSchema.safeParse('a'.repeat(129)).success).toBe(false);
  });

  it('does NOT trim whitespace (10 spaces is valid)', () => {
    const tenSpaces = '          ';
    expect(passwordSchema.parse(tenSpaces)).toBe(tenSpaces);
  });
});

describe('signupBodySchema', () => {
  it('parses a valid body and normalizes the email', () => {
    const result = signupBodySchema.parse({
      email: '  ALICE@example.com  ',
      name: '  Alice  ',
      password: 'correcthorsebatterystaple',
    });
    expect(result).toEqual({
      email: 'alice@example.com',
      name: 'Alice',
      password: 'correcthorsebatterystaple',
    });
  });

  it('strips unknown keys', () => {
    const result = signupBodySchema.parse({
      email: 'alice@example.com',
      name: 'Alice',
      password: 'correcthorsebatterystaple',
      extra: 'ignored',
    } as Record<string, unknown>);
    expect(result).not.toHaveProperty('extra');
  });

  it('fails when name is missing', () => {
    expect(
      signupBodySchema.safeParse({
        email: 'alice@example.com',
        password: 'correcthorsebatterystaple',
      }).success,
    ).toBe(false);
  });

  it('fails when password is too short', () => {
    expect(
      signupBodySchema.safeParse({
        email: 'alice@example.com',
        name: 'Alice',
        password: 'short',
      }).success,
    ).toBe(false);
  });
});

describe('credentialsVerifyBodySchema', () => {
  it('parses email + password', () => {
    const result = credentialsVerifyBodySchema.parse({
      email: 'ALICE@example.com',
      password: 'correcthorsebatterystaple',
    });
    expect(result.email).toBe('alice@example.com');
    expect(result.password).toBe('correcthorsebatterystaple');
  });
});

describe('forgotPasswordBodySchema', () => {
  it('parses an email', () => {
    const result = forgotPasswordBodySchema.parse({ email: '  alice@example.com  ' });
    expect(result.email).toBe('alice@example.com');
  });
});

describe('resetPasswordBodySchema', () => {
  it('parses token + newPassword', () => {
    const result = resetPasswordBodySchema.parse({
      token: 'abc123',
      newPassword: 'a'.repeat(10),
    });
    expect(result.token).toBe('abc123');
    expect(result.newPassword.length).toBe(10);
  });

  it('fails on empty token', () => {
    expect(
      resetPasswordBodySchema.safeParse({
        token: '',
        newPassword: 'a'.repeat(10),
      }).success,
    ).toBe(false);
  });

  it('fails on weak newPassword', () => {
    expect(
      resetPasswordBodySchema.safeParse({
        token: 'abc',
        newPassword: 'short',
      }).success,
    ).toBe(false);
  });
});
