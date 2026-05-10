import { Schema, type HydratedDocument } from 'mongoose';

export class AuditLog {
  static readonly name = 'AuditLog';

  entityType!: string;
  entityId!: string;
  action!: string;
  byUserId!: string;
  at!: Date;
  before?: unknown;
  after?: unknown;
  householdId?: string;
}

export type AuditLogDocument = HydratedDocument<AuditLog>;

export const AuditLogSchema = new Schema<AuditLogDocument>(
  {
    entityType: { type: String, required: true },
    entityId: { type: String, required: true },
    action: { type: String, required: true },
    byUserId: { type: String, required: true },
    at: { type: Date, required: true },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    householdId: { type: String },
  },
  { collection: 'auditLog', versionKey: false, minimize: true },
);
