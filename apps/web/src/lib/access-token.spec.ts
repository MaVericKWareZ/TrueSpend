import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ACCESS_TOKEN_TTL_SECONDS, signAccessToken } from './access-token';

const SECRET = 'test-secret-with-at-least-16-chars';

describe('signAccessToken', () => {
  let originalSecret: string | undefined;

  beforeEach(() => {
    originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = SECRET;
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  });

  it('returns a three-segment JWS string', () => {
    const token = signAccessToken({ userId: 'u1', email: 'a@b.io' });
    expect(token.split('.')).toHaveLength(3);
  });

  it('uses HS256 in the header', () => {
    const token = signAccessToken({ userId: 'u1', email: 'a@b.io' });
    const headerJson = Buffer.from(token.split('.')[0]!, 'base64url').toString('utf8');
    expect(JSON.parse(headerJson)).toMatchObject({ alg: 'HS256', typ: 'JWT' });
  });

  it('verifies via jsonwebtoken.verify with the JWT_SECRET', () => {
    const token = signAccessToken({ userId: 'u1', email: 'a@b.io' });
    const decoded = jwt.verify(token, SECRET, { algorithms: ['HS256'] }) as Record<string, unknown>;
    expect(decoded.sub).toBe('u1');
    expect(decoded.email).toBe('a@b.io');
  });

  it(`has exp - iat = ${ACCESS_TOKEN_TTL_SECONDS} seconds (15 minutes)`, () => {
    const token = signAccessToken({ userId: 'u1', email: 'a@b.io' });
    const decoded = jwt.verify(token, SECRET) as { iat: number; exp: number };
    expect(decoded.exp - decoded.iat).toBe(ACCESS_TOKEN_TTL_SECONDS);
  });

  it('throws when JWT_SECRET is missing', () => {
    delete process.env.JWT_SECRET;
    expect(() => signAccessToken({ userId: 'u1', email: 'a@b.io' })).toThrow(/JWT_SECRET/);
  });

  it('throws when JWT_SECRET is shorter than 16 chars (defense-in-depth)', () => {
    process.env.JWT_SECRET = 'short';
    expect(() => signAccessToken({ userId: 'u1', email: 'a@b.io' })).toThrow();
  });
});
