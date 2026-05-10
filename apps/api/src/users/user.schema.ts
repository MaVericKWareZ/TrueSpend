import { Schema, type HydratedDocument } from 'mongoose';

export class User {
  static readonly name = 'User';

  email!: string;
  name!: string;
  passwordHash!: string;
  passwordResetToken?: string;
  passwordResetExpiresAt?: Date;
  createdAt!: Date;
  updatedAt!: Date;
}

export type UserDocument = HydratedDocument<User>;

export const UserSchema = new Schema<UserDocument>(
  {
    email: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    passwordHash: { type: String, required: true },
    passwordResetToken: { type: String },
    passwordResetExpiresAt: { type: Date },
  },
  { collection: 'users', timestamps: true, versionKey: false, minimize: true },
);
