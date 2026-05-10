import { Reflector } from '@nestjs/core';
import { ThrottlerStorageService } from '@nestjs/throttler';
import { describe, expect, it } from 'vitest';

import { FlyThrottlerGuard } from './fly-throttler-guard';

const buildGuard = (throttleDisabled = false) => {
  const reflector = new Reflector();
  const storage = new ThrottlerStorageService();
  const options = { throttlers: [{ limit: 10, ttl: 60_000 }] };
  const guard = new FlyThrottlerGuard(options, storage, reflector, { throttleDisabled });
  return guard;
};

const exposeTracker = (guard: FlyThrottlerGuard) =>
  (guard as unknown as { getTracker: (req: Record<string, unknown>) => Promise<string> }).getTracker.bind(
    guard,
  );

describe('FlyThrottlerGuard.getTracker', () => {
  it('returns the Fly-Client-IP header when present', async () => {
    const tracker = exposeTracker(buildGuard());
    const result = await tracker({ headers: { 'fly-client-ip': '1.2.3.4' }, ip: '127.0.0.1' });
    expect(result).toBe('1.2.3.4');
  });

  it('falls back to req.ip when the header is missing', async () => {
    const tracker = exposeTracker(buildGuard());
    const result = await tracker({ headers: {}, ip: '127.0.0.1' });
    expect(result).toBe('127.0.0.1');
  });

  it('falls back to req.ip when the header is an empty string', async () => {
    const tracker = exposeTracker(buildGuard());
    const result = await tracker({ headers: { 'fly-client-ip': '' }, ip: '127.0.0.1' });
    expect(result).toBe('127.0.0.1');
  });

  it('uses the first value when the header is comma-separated', async () => {
    const tracker = exposeTracker(buildGuard());
    const result = await tracker({
      headers: { 'fly-client-ip': '5.6.7.8, 1.2.3.4' },
      ip: '127.0.0.1',
    });
    expect(result).toBe('5.6.7.8');
  });

  it('returns the value regardless of header casing (Express lowercases on read)', async () => {
    const tracker = exposeTracker(buildGuard());
    const result = await tracker({
      headers: { 'fly-client-ip': '9.9.9.9' },
      ip: '127.0.0.1',
    });
    expect(result).toBe('9.9.9.9');
  });
});

describe('FlyThrottlerGuard.shouldSkip', () => {
  it('returns true when THROTTLE_DISABLED is true', async () => {
    const guard = buildGuard(true);
    const skip = await (guard as unknown as { shouldSkip: () => Promise<boolean> }).shouldSkip();
    expect(skip).toBe(true);
  });

  it('returns false when THROTTLE_DISABLED is false', async () => {
    const guard = buildGuard(false);
    const skip = await (guard as unknown as { shouldSkip: () => Promise<boolean> }).shouldSkip();
    expect(skip).toBe(false);
  });
});

describe('FlyThrottlerGuard.throwThrottlingException', () => {
  it('throws an HttpException with 429 status and { error, retryAfterSeconds } body', async () => {
    const guard = buildGuard();
    const fakeContext = {
      switchToHttp: () => ({
        getResponse: () => ({ header: () => undefined }),
        getRequest: () => ({}),
      }),
    } as never;
    const detail = { ttl: 30_000, limit: 10, totalHits: 11, key: 'x', tracker: '1.2.3.4', isBlocked: true, timeToBlockExpire: 30, timeToExpire: 30 } as never;
    await expect(
      (guard as unknown as {
        throwThrottlingException: (ctx: unknown, d: unknown) => Promise<void>;
      }).throwThrottlingException(fakeContext, detail),
    ).rejects.toMatchObject({
      status: 429,
      response: { error: 'rate_limited', retryAfterSeconds: expect.any(Number) },
    });
  });
});
