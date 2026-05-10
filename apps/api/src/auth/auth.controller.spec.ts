import { createHash } from 'node:crypto';
import { Logger } from '@nestjs/common';
import mongoose, { type Model } from 'mongoose';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { AuditLoggerService } from '../audit/audit-logger.service';
import { AuthService } from './auth.service';
import { User, UserSchema, type UserDocument } from '../users/user.schema';
import {
  buildAuthTestApp,
  type TestAppHandle,
} from '../../test/helpers/build-auth-test-app';

const sha256 = (raw: string) => createHash('sha256').update(raw, 'utf8').digest('hex');

const extractTokenFromUrl = (text: string): string => {
  const match = /token=([a-f0-9]{64})/.exec(text);
  if (!match) throw new Error(`No reset token found in mailer text: ${text}`);
  return match[1]!;
};

describe('AuthController', () => {
  let handle: TestAppHandle;
  let userModel: Model<UserDocument>;

  beforeAll(async () => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    handle = await buildAuthTestApp({ dbName: 'auth-controller-spec' });
    userModel = handle.moduleRef.get<Model<UserDocument>>(`${User.name}Model`);
  });

  afterEach(async () => {
    await handle.cleanupCollections();
    handle.mailerSend.mockClear();
  });

  afterAll(async () => {
    await handle.close();
    vi.restoreAllMocks();
  });

  describe('POST /auth/signup', () => {
    it('creates a user with an argon2id hash on the happy path', async () => {
      const res = await request(handle.app.getHttpServer())
        .post('/auth/signup')
        .send({
          email: 'alice@example.com',
          name: 'Alice',
          password: 'correcthorsebatterystaple',
        });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ id: expect.any(String) });

      const stored = await userModel.findOne({ email: 'alice@example.com' }).lean().exec();
      expect(stored?.passwordHash).toMatch(/^\$argon2id\$v=19\$/);
    });

    it('returns 409 with email_already_in_use on duplicate', async () => {
      await request(handle.app.getHttpServer())
        .post('/auth/signup')
        .send({ email: 'alice@example.com', name: 'Alice', password: 'a'.repeat(10) });
      const res = await request(handle.app.getHttpServer())
        .post('/auth/signup')
        .send({ email: 'alice@example.com', name: 'Alice2', password: 'a'.repeat(10) });
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ statusCode: 409, message: 'email_already_in_use' });
    });

    it('returns 400 with validation errors on bad input', async () => {
      const res = await request(handle.app.getHttpServer())
        .post('/auth/signup')
        .send({ email: 'not-email', name: '', password: 'short' });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Validation failed');
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: 'email' }),
          expect.objectContaining({ path: 'name' }),
          expect.objectContaining({ path: 'password' }),
        ]),
      );
    });

    it('normalizes the email end-to-end', async () => {
      await request(handle.app.getHttpServer())
        .post('/auth/signup')
        .send({
          email: '  ALICE@Example.com  ',
          name: '  Alice  ',
          password: 'a'.repeat(10),
        })
        .expect(201);
      const stored = await userModel.findOne({}).lean().exec();
      expect(stored?.email).toBe('alice@example.com');
      expect(stored?.name).toBe('Alice');
    });

    it('does not require an Authorization header (PUBLIC_AUTH_ROUTES regression)', async () => {
      const res = await request(handle.app.getHttpServer())
        .post('/auth/signup')
        .send({ email: 'bob@example.com', name: 'Bob', password: 'a'.repeat(10) });
      expect(res.status).not.toBe(401);
    });

    it('writes an audit log entry for the new user (fire-and-forget)', async () => {
      const auditSpy = vi.spyOn(handle.moduleRef.get(AuditLoggerService), 'write');
      await request(handle.app.getHttpServer())
        .post('/auth/signup')
        .send({ email: 'eve@example.com', name: 'Eve', password: 'a'.repeat(10) })
        .expect(201);
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({ entityType: 'User', action: 'create' }),
      );
      auditSpy.mockRestore();
    });
  });

  describe('POST /auth/credentials-verify', () => {
    const seed = async () =>
      request(handle.app.getHttpServer())
        .post('/auth/signup')
        .send({ email: 'alice@example.com', name: 'Alice', password: 'a'.repeat(10) })
        .expect(201);

    it('returns 200 with { id, email, name } on correct password', async () => {
      await seed();
      const res = await request(handle.app.getHttpServer())
        .post('/auth/credentials-verify')
        .send({ email: 'alice@example.com', password: 'a'.repeat(10) });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        id: expect.any(String),
        email: 'alice@example.com',
        name: 'Alice',
      });
    });

    it('returns generic 401 on wrong password', async () => {
      await seed();
      const res = await request(handle.app.getHttpServer())
        .post('/auth/credentials-verify')
        .send({ email: 'alice@example.com', password: 'b'.repeat(10) });
      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({ statusCode: 401, message: 'Invalid email or password' });
    });

    it('returns the SAME 401 body on unknown email (no enumeration leak)', async () => {
      await seed();
      const wrongPassword = await request(handle.app.getHttpServer())
        .post('/auth/credentials-verify')
        .send({ email: 'alice@example.com', password: 'b'.repeat(10) });
      const unknownEmail = await request(handle.app.getHttpServer())
        .post('/auth/credentials-verify')
        .send({ email: 'nobody@example.com', password: 'b'.repeat(10) });
      expect(unknownEmail.status).toBe(401);
      expect(unknownEmail.body).toEqual(wrongPassword.body);
    });

    it('still calls hasher.verify on unknown email (timing-oracle defense)', async () => {
      const auth = handle.moduleRef.get(AuthService);
      const hasher = (auth as unknown as { hasher: { verify: (...args: unknown[]) => Promise<boolean> } }).hasher;
      const verifySpy = vi.spyOn(hasher, 'verify');
      await request(handle.app.getHttpServer())
        .post('/auth/credentials-verify')
        .send({ email: 'nobody@example.com', password: 'a'.repeat(10) })
        .expect(401);
      expect(verifySpy).toHaveBeenCalledOnce();
      verifySpy.mockRestore();
    });

    it('returns 400 on validation failure', async () => {
      const res = await request(handle.app.getHttpServer())
        .post('/auth/credentials-verify')
        .send({ email: 'not-email', password: 'short' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /auth/forgot-password', () => {
    const seed = async () =>
      request(handle.app.getHttpServer())
        .post('/auth/signup')
        .send({ email: 'alice@example.com', name: 'Alice', password: 'a'.repeat(10) })
        .expect(201);

    it('returns 404 { error: "no_account_for_email" } for unknown email', async () => {
      const res = await request(handle.app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'nobody@example.com' });
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'no_account_for_email' });
    });

    it('sends one email and persists hashed token + expiry on known email', async () => {
      await seed();
      const before = Date.now();
      const res = await request(handle.app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'alice@example.com' });
      expect(res.status).toBe(200);
      expect(handle.mailerSend).toHaveBeenCalledOnce();

      const sent = handle.mailerSend.mock.calls[0]![0]!;
      expect(sent.to).toBe('alice@example.com');
      expect(sent.subject.toLowerCase()).toContain('reset');
      const rawToken = extractTokenFromUrl(sent.text);

      const stored = await userModel.findOne({ email: 'alice@example.com' }).lean().exec();
      expect(stored?.passwordResetToken).toBe(sha256(rawToken));
      expect(stored?.passwordResetExpiresAt?.getTime()).toBeGreaterThan(before);
      expect(stored?.passwordResetExpiresAt?.getTime()).toBeLessThan(before + 61 * 60_000);
    });

    it('overwrites a prior token on re-request', async () => {
      await seed();
      await request(handle.app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'alice@example.com' })
        .expect(200);
      const firstSent = handle.mailerSend.mock.calls[0]![0]!;
      const firstRaw = extractTokenFromUrl(firstSent.text);

      await request(handle.app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'alice@example.com' })
        .expect(200);
      const secondSent = handle.mailerSend.mock.calls[1]![0]!;
      const secondRaw = extractTokenFromUrl(secondSent.text);
      expect(secondRaw).not.toBe(firstRaw);

      const stored = await userModel.findOne({ email: 'alice@example.com' }).lean().exec();
      expect(stored?.passwordResetToken).toBe(sha256(secondRaw));
      expect(stored?.passwordResetToken).not.toBe(sha256(firstRaw));
    });
  });

  describe('POST /auth/reset-password', () => {
    const seedAndRequestReset = async (): Promise<{ rawToken: string }> => {
      await request(handle.app.getHttpServer())
        .post('/auth/signup')
        .send({ email: 'alice@example.com', name: 'Alice', password: 'a'.repeat(10) })
        .expect(201);
      await request(handle.app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'alice@example.com' })
        .expect(200);
      return { rawToken: extractTokenFromUrl(handle.mailerSend.mock.calls[0]![0]!.text) };
    };

    it('200 on happy path; updates password; clears reset fields', async () => {
      const { rawToken } = await seedAndRequestReset();
      await request(handle.app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: rawToken, newPassword: 'newpassword!1' })
        .expect(200);

      const stored = await userModel.findOne({ email: 'alice@example.com' }).lean().exec();
      expect(stored?.passwordResetToken).toBeUndefined();
      expect(stored?.passwordResetExpiresAt).toBeUndefined();

      // verify new password works
      await request(handle.app.getHttpServer())
        .post('/auth/credentials-verify')
        .send({ email: 'alice@example.com', password: 'newpassword!1' })
        .expect(200);
    });

    it('400 invalid_or_expired_token on unknown token', async () => {
      const res = await request(handle.app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: 'a'.repeat(64), newPassword: 'newpassword!1' });
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: 'invalid_or_expired_token' });
    });

    it('400 on expired token', async () => {
      const { rawToken } = await seedAndRequestReset();
      // Force-expire by direct DB write
      await userModel.updateOne(
        { email: 'alice@example.com' },
        { $set: { passwordResetExpiresAt: new Date(Date.now() - 1000) } },
      );
      const res = await request(handle.app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: rawToken, newPassword: 'newpassword!1' });
      expect(res.status).toBe(400);
    });

    it('rejects re-use of a single-use token', async () => {
      const { rawToken } = await seedAndRequestReset();
      await request(handle.app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: rawToken, newPassword: 'newpassword!1' })
        .expect(200);
      const res = await request(handle.app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: rawToken, newPassword: 'anotherpw!2' });
      expect(res.status).toBe(400);
    });

    it('400 on validation failure (weak newPassword)', async () => {
      const res = await request(handle.app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: 'irrelevant', newPassword: 'short' });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Validation failed');
    });

    it('writes an audit log entry on successful reset', async () => {
      const { rawToken } = await seedAndRequestReset();
      const auditSpy = vi.spyOn(handle.moduleRef.get(AuditLoggerService), 'write');
      await request(handle.app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: rawToken, newPassword: 'newpassword!1' })
        .expect(200);
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({ entityType: 'User', action: 'password_reset' }),
      );
      auditSpy.mockRestore();
    });
  });
});
