import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import mongoose, { type Model } from 'mongoose';
import { AuditLog, AuditLogSchema, type AuditLogDocument } from './audit-log.schema';
import { AuditLoggerService } from './audit-logger.service';
import { startInMemoryMongo, stopInMemoryMongo } from '../../test/helpers/mongo-memory';

describe('AuditLoggerService', () => {
  let model: Model<AuditLogDocument>;
  let service: AuditLoggerService;

  beforeAll(async () => {
    const uri = await startInMemoryMongo();
    await mongoose.connect(uri);
    model = mongoose.model<AuditLogDocument>(AuditLog.name, AuditLogSchema);
    service = new AuditLoggerService(model);
  });

  afterEach(async () => {
    await model.deleteMany({}).exec();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await stopInMemoryMongo();
  });

  it('persists a document with entityType, entityId, action, and byUserId', async () => {
    await service.write({
      entityType: 'Expense',
      entityId: 'expense-1',
      action: 'create',
      byUserId: 'user-1',
    });

    const docs = await model.find({}).lean().exec();
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({
      entityType: 'Expense',
      entityId: 'expense-1',
      action: 'create',
      byUserId: 'user-1',
    });
  });

  it('stamps a server-generated `at: Date` near now', async () => {
    const before = Date.now();
    await service.write({
      entityType: 'Expense',
      entityId: 'expense-1',
      action: 'create',
      byUserId: 'user-1',
    });
    const after = Date.now();

    const [doc] = await model.find({}).lean().exec();
    expect(doc?.at).toBeInstanceOf(Date);
    const at = doc!.at!.getTime();
    expect(at).toBeGreaterThanOrEqual(before);
    expect(at).toBeLessThanOrEqual(after);
  });

  it('round-trips arbitrary `before` and `after` payloads', async () => {
    const beforePayload = { amount: 100, tags: ['groceries', 'weekly'], paid_by: 'alice' };
    const afterPayload = { amount: 120, tags: ['groceries'], paid_by: 'bob' };

    await service.write({
      entityType: 'Expense',
      entityId: 'expense-1',
      action: 'update',
      byUserId: 'user-1',
      before: beforePayload,
      after: afterPayload,
    });

    const [doc] = await model.find({}).lean().exec();
    expect(doc?.before).toEqual(beforePayload);
    expect(doc?.after).toEqual(afterPayload);
  });

  it('omits `before` and `after` from the document when not provided', async () => {
    await service.write({
      entityType: 'Expense',
      entityId: 'expense-1',
      action: 'create',
      byUserId: 'user-1',
    });

    const [doc] = await model.find({}).lean().exec();
    expect(doc).not.toHaveProperty('before');
    expect(doc).not.toHaveProperty('after');
  });

  it('persists `householdId` when provided', async () => {
    await service.write({
      entityType: 'Expense',
      entityId: 'expense-1',
      action: 'create',
      byUserId: 'user-1',
      householdId: 'household-7',
    });

    const [doc] = await model.find({}).lean().exec();
    expect(doc?.householdId).toBe('household-7');
  });

  it('omits `householdId` from the document when not provided', async () => {
    await service.write({
      entityType: 'Expense',
      entityId: 'expense-1',
      action: 'create',
      byUserId: 'user-1',
    });

    const [doc] = await model.find({}).lean().exec();
    expect(doc).not.toHaveProperty('householdId');
  });

  it('resolves and logs an error when the Mongo write fails (fire-and-forget)', async () => {
    const errorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    const createSpy = vi.spyOn(model, 'create').mockRejectedValueOnce(
      new Error('boom') as never,
    );

    await expect(
      service.write({
        entityType: 'Expense',
        entityId: 'expense-1',
        action: 'create',
        byUserId: 'user-1',
      }),
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledOnce();
    createSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('handles parallel writes without serialising on shared state', async () => {
    const writes = [
      service.write({ entityType: 'Expense', entityId: 'e1', action: 'create', byUserId: 'u1' }),
      service.write({ entityType: 'Expense', entityId: 'e2', action: 'create', byUserId: 'u2' }),
      service.write({ entityType: 'Expense', entityId: 'e3', action: 'create', byUserId: 'u3' }),
    ];
    await Promise.all(writes);

    const docs = await model.find({}).lean().exec();
    expect(docs).toHaveLength(3);
    const ids = docs.map((d) => d.entityId).sort();
    expect(ids).toEqual(['e1', 'e2', 'e3']);
  });
});
