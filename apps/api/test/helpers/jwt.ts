import jwt, { type Algorithm, type SignOptions } from 'jsonwebtoken';

export const TEST_SECRET = 'test-secret-do-not-use-in-prod';

export interface SignTestTokenOptions {
  secret?: string;
  algorithm?: Algorithm;
  sub?: string;
  email?: string;
  expiresIn?: SignOptions['expiresIn'];
  payload?: Record<string, unknown>;
}

export function signTestToken(options: SignTestTokenOptions = {}): string {
  const {
    secret = TEST_SECRET,
    algorithm = 'HS256',
    sub = 'user-1',
    email = 'user-1@example.com',
    expiresIn = '1h',
    payload,
  } = options;

  const claims = payload ?? { sub, email };
  return jwt.sign(claims, secret, { algorithm, ...(payload ? {} : { expiresIn }) });
}
