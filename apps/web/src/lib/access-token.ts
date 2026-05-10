import jwt from 'jsonwebtoken';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

export interface SignAccessTokenArgs {
  userId: string;
  email: string;
}

export function signAccessToken({ userId, email }: SignAccessTokenArgs): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('JWT_SECRET must be set and at least 16 characters long');
  }
  return jwt.sign(
    { sub: userId, email },
    secret,
    { algorithm: 'HS256', expiresIn: ACCESS_TOKEN_TTL_SECONDS },
  );
}
