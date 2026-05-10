import { Inject, Injectable, type NestMiddleware } from '@nestjs/common';
import type { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { AuthenticatedRequest } from './authenticated-request';

export const JWT_SECRET_TOKEN = Symbol.for('AuthBridge.JWT_SECRET');

@Injectable()
export class AuthBridge implements NestMiddleware {
  constructor(@Inject(JWT_SECRET_TOKEN) private readonly jwtSecret: string) {}

  use(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
    const token = extractBearerToken(req.headers['authorization']);
    if (!token) return unauthorized(res);

    let payload: jwt.JwtPayload;
    try {
      const decoded = jwt.verify(token, this.jwtSecret, { algorithms: ['HS256'] });
      if (typeof decoded !== 'object' || decoded === null) return unauthorized(res);
      payload = decoded;
    } catch {
      return unauthorized(res);
    }

    const sub = payload.sub;
    const email = payload['email'];
    if (typeof sub !== 'string' || sub.length === 0 || typeof email !== 'string' || email.length === 0) {
      return unauthorized(res);
    }

    req.auth = { userId: sub, email };
    next();
  }
}

function extractBearerToken(header: string | string[] | undefined): string | null {
  if (typeof header !== 'string') return null;
  const match = /^Bearer\s+(\S.*)$/.exec(header);
  return match?.[1]?.trim() || null;
}

function unauthorized(res: Response): void {
  res.status(401).json({ statusCode: 401, message: 'Unauthorized' });
}
