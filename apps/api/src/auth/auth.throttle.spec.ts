import { Logger } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildAuthTestApp,
  type TestAppHandle,
} from '../../test/helpers/build-auth-test-app';

describe('Auth throttler (real limiter, no THROTTLE_DISABLED)', () => {
  let handle: TestAppHandle;

  beforeAll(async () => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    handle = await buildAuthTestApp({
      dbName: 'auth-throttle-spec',
      throttleDisabled: false,
    });
  });

  beforeEach(async () => {
    await handle.cleanupCollections();
    handle.mailerSend.mockClear();
  });

  afterAll(async () => {
    await handle.close();
    vi.restoreAllMocks();
  });

  it('returns 429 with { error, retryAfterSeconds } body on the 11th sign-in from the same Fly-Client-IP', async () => {
    await request(handle.app.getHttpServer())
      .post('/auth/signup')
      .send({ email: 'rate@example.com', name: 'Rate', password: 'a'.repeat(10) })
      .expect(201);

    const send = () =>
      request(handle.app.getHttpServer())
        .post('/auth/credentials-verify')
        .set('Fly-Client-IP', '203.0.113.7')
        .send({ email: 'rate@example.com', password: 'wrong-password' });

    // 10 attempts within window — all 401 (wrong password) but not throttled
    for (let i = 0; i < 10; i++) {
      const res = await send();
      expect(res.status).toBe(401);
    }

    // 11th attempt — throttled
    const eleventh = await send();
    expect(eleventh.status).toBe(429);
    expect(eleventh.body).toMatchObject({
      error: 'rate_limited',
      retryAfterSeconds: expect.any(Number),
    });
  });

  it('isolates rate-limit buckets per Fly-Client-IP', async () => {
    const callForgot = (ip: string) =>
      request(handle.app.getHttpServer())
        .post('/auth/forgot-password')
        .set('Fly-Client-IP', ip)
        .send({ email: 'never-exists@example.com' });

    // 5 forgots from 1.2.3.4 — all 404 (limit is 5/h, exhausts the bucket)
    for (let i = 0; i < 5; i++) {
      const res = await callForgot('1.2.3.4');
      expect(res.status).toBe(404);
    }
    // 6th from 1.2.3.4 — 429
    expect((await callForgot('1.2.3.4')).status).toBe(429);
    // But a different IP still has a fresh bucket — not throttled
    expect((await callForgot('5.6.7.8')).status).toBe(404);
  });
});
