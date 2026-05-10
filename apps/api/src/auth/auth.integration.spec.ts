import { Logger } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  buildAuthTestApp,
  type TestAppHandle,
} from '../../test/helpers/build-auth-test-app';

describe('Auth flow: signup → sign-in → forgot → reset → sign-in (covers AC line 173)', () => {
  let handle: TestAppHandle;
  const oldPassword = 'oldpassword01';
  const newPassword = 'newpassword42';

  beforeAll(async () => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    handle = await buildAuthTestApp({ dbName: 'auth-integration-spec' });
  });

  afterAll(async () => {
    await handle.close();
    vi.restoreAllMocks();
  });

  it('round-trips through every endpoint and the old password stops working', async () => {
    // 1. Signup
    const signup = await request(handle.app.getHttpServer())
      .post('/auth/signup')
      .send({ email: 'flow@example.com', name: 'Flow', password: oldPassword });
    expect(signup.status).toBe(201);

    // 2. Sign in with old password
    const verify1 = await request(handle.app.getHttpServer())
      .post('/auth/credentials-verify')
      .send({ email: 'flow@example.com', password: oldPassword });
    expect(verify1.status).toBe(200);

    // 3. Forgot password — capture token from mailer spy
    const forgot = await request(handle.app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'flow@example.com' });
    expect(forgot.status).toBe(200);
    const sent = handle.mailerSend.mock.calls.at(-1)![0]!;
    const tokenMatch = /token=([a-f0-9]{64})/.exec(sent.text);
    expect(tokenMatch).toBeTruthy();
    const rawToken = tokenMatch![1]!;

    // 4. Reset password
    const reset = await request(handle.app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: rawToken, newPassword });
    expect(reset.status).toBe(200);

    // 5. Sign in with NEW password works
    const verify2 = await request(handle.app.getHttpServer())
      .post('/auth/credentials-verify')
      .send({ email: 'flow@example.com', password: newPassword });
    expect(verify2.status).toBe(200);

    // 6. Sign in with OLD password is rejected
    const verify3 = await request(handle.app.getHttpServer())
      .post('/auth/credentials-verify')
      .send({ email: 'flow@example.com', password: oldPassword });
    expect(verify3.status).toBe(401);
  });
});
