import mongoose, { type Model } from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { User, UserSchema, type UserDocument } from './user.schema';
import { startInMemoryMongo, stopInMemoryMongo } from '../../test/helpers/mongo-memory';

describe('User schema', () => {
  let model: Model<UserDocument>;

  beforeAll(async () => {
    const uri = await startInMemoryMongo('user-schema-spec');
    await mongoose.connect(uri);
    model = mongoose.model<UserDocument>(User.name, UserSchema);
    await model.syncIndexes();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await stopInMemoryMongo();
  });

  it('rejects a duplicate email with Mongo error code 11000', async () => {
    await model.create({
      email: 'alice@example.com',
      name: 'Alice',
      passwordHash: 'irrelevant-for-this-test',
    });

    let captured: unknown;
    try {
      await model.create({
        email: 'alice@example.com',
        name: 'Alice 2',
        passwordHash: 'irrelevant',
      });
    } catch (err) {
      captured = err;
    }
    expect((captured as { code?: number })?.code).toBe(11000);
  });
});
