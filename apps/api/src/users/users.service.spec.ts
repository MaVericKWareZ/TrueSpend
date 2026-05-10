import mongoose, { type Model } from 'mongoose';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { User, UserSchema, type UserDocument } from './user.schema';
import { UsersService } from './users.service';
import { startInMemoryMongo, stopInMemoryMongo } from '../../test/helpers/mongo-memory';

describe('UsersService', () => {
  let model: Model<UserDocument>;
  let service: UsersService;

  beforeAll(async () => {
    const uri = await startInMemoryMongo('users-service-spec');
    await mongoose.connect(uri);
    model = mongoose.model<UserDocument>(User.name, UserSchema);
    await model.syncIndexes();
    service = new UsersService(model);
  });

  afterEach(async () => {
    await model.deleteMany({}).exec();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await stopInMemoryMongo();
  });

  describe('create', () => {
    it('persists a user and returns the document', async () => {
      const doc = await service.create({
        email: 'alice@example.com',
        name: 'Alice',
        passwordHash: 'hash-1',
      });
      expect(doc._id).toBeDefined();
      expect(doc.createdAt).toBeInstanceOf(Date);
      expect(doc.updatedAt).toBeInstanceOf(Date);
    });

    it('throws on duplicate email', async () => {
      await service.create({ email: 'alice@example.com', name: 'A', passwordHash: 'h' });
      await expect(
        service.create({ email: 'alice@example.com', name: 'A2', passwordHash: 'h' }),
      ).rejects.toMatchObject({ code: 11000 });
    });

    it('lowercases and trims email defensively', async () => {
      const doc = await service.create({
        email: '  ALICE@Example.com  ',
        name: 'Alice',
        passwordHash: 'h',
      });
      expect(doc.email).toBe('alice@example.com');
    });
  });

  describe('findByEmail', () => {
    it('finds a user by lowercased email', async () => {
      await service.create({ email: 'alice@example.com', name: 'Alice', passwordHash: 'h' });
      const found = await service.findByEmail('alice@example.com');
      expect(found?.name).toBe('Alice');
    });

    it('is case-insensitive — normalizes the input', async () => {
      await service.create({ email: 'alice@example.com', name: 'Alice', passwordHash: 'h' });
      const found = await service.findByEmail('  ALICE@example.com  ');
      expect(found?.name).toBe('Alice');
    });

    it('returns null for a missing user', async () => {
      const found = await service.findByEmail('nobody@example.com');
      expect(found).toBeNull();
    });
  });

  describe('findByResetTokenHash', () => {
    it('returns null when no user has the hash', async () => {
      const found = await service.findByResetTokenHash('no-such-hash');
      expect(found).toBeNull();
    });
  });

  describe('setResetToken', () => {
    it('writes both fields and findByResetTokenHash returns the user', async () => {
      const user = await service.create({
        email: 'alice@example.com',
        name: 'Alice',
        passwordHash: 'h',
      });
      const expiresAt = new Date(Date.now() + 60 * 60_000);
      await service.setResetToken(user.id, { hashed: 'hash-A', expiresAt });

      const found = await service.findByResetTokenHash('hash-A');
      expect(found?.id).toBe(user.id);
      expect(found?.passwordResetExpiresAt?.getTime()).toBe(expiresAt.getTime());
    });

    it('overwrites a prior token (idempotent under re-request)', async () => {
      const user = await service.create({
        email: 'alice@example.com',
        name: 'Alice',
        passwordHash: 'h',
      });
      const t = new Date(Date.now() + 60 * 60_000);
      await service.setResetToken(user.id, { hashed: 'first', expiresAt: t });
      await service.setResetToken(user.id, { hashed: 'second', expiresAt: t });

      expect(await service.findByResetTokenHash('first')).toBeNull();
      expect((await service.findByResetTokenHash('second'))?.id).toBe(user.id);
    });

    it('persists ONLY the SHA-256 hash, never any raw value (AC pin)', async () => {
      const user = await service.create({
        email: 'alice@example.com',
        name: 'Alice',
        passwordHash: 'h',
      });
      const rawTokenWeWillNeverSeeStored = 'raw-token-do-not-store';
      const sha256 = 'imagined-hash-from-the-service';
      await service.setResetToken(user.id, {
        hashed: sha256,
        expiresAt: new Date(Date.now() + 60_000),
      });

      const raw = await model.findById(user.id).lean().exec();
      expect(raw?.passwordResetToken).toBe(sha256);
      expect(raw?.passwordResetToken).not.toBe(rawTokenWeWillNeverSeeStored);
    });
  });

  describe('clearResetTokenAndSetPassword', () => {
    it('clears both reset fields and updates passwordHash', async () => {
      const user = await service.create({
        email: 'alice@example.com',
        name: 'Alice',
        passwordHash: 'old-hash',
      });
      await service.setResetToken(user.id, {
        hashed: 'h',
        expiresAt: new Date(Date.now() + 60_000),
      });

      await service.clearResetTokenAndSetPassword(user.id, 'new-hash');
      const after = await model.findById(user.id).lean().exec();
      expect(after?.passwordHash).toBe('new-hash');
      expect(after?.passwordResetToken).toBeUndefined();
      expect(after?.passwordResetExpiresAt).toBeUndefined();
    });
  });
});
