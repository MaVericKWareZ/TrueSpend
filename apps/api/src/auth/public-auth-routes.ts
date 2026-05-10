import { RequestMethod } from '@nestjs/common';

/**
 * Routes that must bypass {@link AuthBridge}: the user has not yet
 * authenticated when calling them. AppModule and any e2e test that
 * reproduces the global middleware wiring import this list to stay in
 * sync.
 */
export const PUBLIC_AUTH_ROUTES = [
  { path: 'auth/signup', method: RequestMethod.POST },
  { path: 'auth/credentials-verify', method: RequestMethod.POST },
  { path: 'auth/forgot-password', method: RequestMethod.POST },
  { path: 'auth/reset-password', method: RequestMethod.POST },
] as const;
