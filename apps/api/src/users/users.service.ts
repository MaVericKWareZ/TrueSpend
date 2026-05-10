import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model, Types } from 'mongoose';

import { User, type UserDocument } from './user.schema';

export interface CreateUserArgs {
  email: string;
  name: string;
  passwordHash: string;
}

export interface SetResetTokenArgs {
  hashed: string;
  expiresAt: Date;
}

const normalizeEmail = (raw: string): string => raw.trim().toLowerCase();

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly model: Model<UserDocument>) {}

  create(args: CreateUserArgs): Promise<UserDocument> {
    return this.model.create({
      email: normalizeEmail(args.email),
      name: args.name.trim(),
      passwordHash: args.passwordHash,
    });
  }

  findByEmail(email: string): Promise<UserDocument | null> {
    return this.model.findOne({ email: normalizeEmail(email) }).exec();
  }

  findByResetTokenHash(hashed: string): Promise<UserDocument | null> {
    return this.model.findOne({ passwordResetToken: hashed }).exec();
  }

  async setResetToken(
    userId: string | Types.ObjectId,
    args: SetResetTokenArgs,
  ): Promise<void> {
    await this.model
      .updateOne(
        { _id: userId },
        {
          $set: {
            passwordResetToken: args.hashed,
            passwordResetExpiresAt: args.expiresAt,
          },
        },
      )
      .exec();
  }

  async clearResetTokenAndSetPassword(
    userId: string | Types.ObjectId,
    newPasswordHash: string,
  ): Promise<void> {
    await this.model
      .updateOne(
        { _id: userId },
        {
          $set: { passwordHash: newPasswordHash },
          $unset: { passwordResetToken: '', passwordResetExpiresAt: '' },
        },
      )
      .exec();
  }
}
