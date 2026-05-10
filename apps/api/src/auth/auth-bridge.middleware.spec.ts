import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Response, NextFunction } from 'express';
import { AuthBridge } from './auth-bridge.middleware';
import type { AuthenticatedRequest } from './authenticated-request';
import { TEST_SECRET, signTestToken } from '../../test/helpers/jwt';

interface MockRes {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
}

function buildRes(): MockRes {
  const res: MockRes = {
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

function buildReq(headers: Record<string, string | undefined> = {}): AuthenticatedRequest {
  return { headers } as unknown as AuthenticatedRequest;
}

describe('AuthBridge', () => {
  let bridge: AuthBridge;
  let res: MockRes;
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    bridge = new AuthBridge(TEST_SECRET);
    res = buildRes();
    next = vi.fn();
  });

  it('returns 401 when the Authorization header is missing', () => {
    const req = buildReq({});

    bridge.use(req, res as unknown as Response, next as unknown as NextFunction);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it.each([
    ['Basic xyz', 'Basic auth scheme'],
    ['Bearer', 'bare Bearer with no token'],
    ['Bearer ', 'Bearer with empty token'],
    ['xyz', 'no scheme'],
  ])('returns 401 when Authorization header is %j (%s)', (authorization) => {
    const req = buildReq({ authorization });

    bridge.use(req, res as unknown as Response, next as unknown as NextFunction);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it.each([
    ['Bearer not-a-jwt', 'random string'],
    ['Bearer aaa.bbb', 'two-segment string'],
    ['Bearer aaa.bbb.ccc.ddd', 'four-segment string'],
  ])('returns 401 when token is structurally malformed (%s)', (authorization) => {
    const req = buildReq({ authorization });

    bridge.use(req, res as unknown as Response, next as unknown as NextFunction);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when token is signed with the wrong secret', () => {
    const token = signTestToken({ secret: 'a-different-secret-32-chars-long' });
    const req = buildReq({ authorization: `Bearer ${token}` });

    bridge.use(req, res as unknown as Response, next as unknown as NextFunction);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when token is signed with a non-HS256 algorithm', () => {
    const token = signTestToken({ algorithm: 'HS512' });
    const req = buildReq({ authorization: `Bearer ${token}` });

    bridge.use(req, res as unknown as Response, next as unknown as NextFunction);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when token is expired', () => {
    const token = signTestToken({ expiresIn: '-1s' });
    const req = buildReq({ authorization: `Bearer ${token}` });

    bridge.use(req, res as unknown as Response, next as unknown as NextFunction);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() and writes no response when token is valid', () => {
    const token = signTestToken();
    const req = buildReq({ authorization: `Bearer ${token}` });

    bridge.use(req, res as unknown as Response, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('populates req.auth from sub and email claims when token is valid', () => {
    const token = signTestToken({ sub: 'user-42', email: 'alice@example.com' });
    const req = buildReq({ authorization: `Bearer ${token}` });

    bridge.use(req, res as unknown as Response, next as unknown as NextFunction);

    expect(req.auth).toEqual({ userId: 'user-42', email: 'alice@example.com' });
    expect(next).toHaveBeenCalledOnce();
  });

  it.each<[Record<string, unknown>, string]>([
    [{ email: 'alice@example.com' }, 'missing sub'],
    [{ sub: 'user-42' }, 'missing email'],
    [{}, 'missing both'],
  ])('returns 401 when token is well-signed but %s', (payload) => {
    const token = signTestToken({ payload });
    const req = buildReq({ authorization: `Bearer ${token}` });

    bridge.use(req, res as unknown as Response, next as unknown as NextFunction);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    expect(req.auth).toBeUndefined();
  });
});
