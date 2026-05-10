import { Injectable, Logger } from '@nestjs/common';
import type { Model } from 'mongoose';
import type { AuditLogDocument } from './audit-log.schema';

export interface AuditWriteArgs {
  entityType: string;
  entityId: string;
  action: string;
  byUserId: string;
  before?: unknown;
  after?: unknown;
  householdId?: string;
}

@Injectable()
export class AuditLoggerService {
  private readonly logger = new Logger(AuditLoggerService.name);

  constructor(private readonly model: Model<AuditLogDocument>) {}

  async write(args: AuditWriteArgs): Promise<void> {
    const doc: Record<string, unknown> = {
      entityType: args.entityType,
      entityId: args.entityId,
      action: args.action,
      byUserId: args.byUserId,
      at: new Date(),
    };
    if (args.before !== undefined) doc['before'] = args.before;
    if (args.after !== undefined) doc['after'] = args.after;
    if (args.householdId !== undefined) doc['householdId'] = args.householdId;

    try {
      await this.model.create(doc);
    } catch (err) {
      this.logger.error(
        `Failed to persist audit log for ${args.entityType}/${args.entityId} action=${args.action}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
