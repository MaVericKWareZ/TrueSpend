import type { Request } from 'express';
import type { AuthContext } from '@expense/shared';

export interface AuthenticatedRequest extends Request {
  auth?: AuthContext;
}
