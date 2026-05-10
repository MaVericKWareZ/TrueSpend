import { Module } from '@nestjs/common';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { AuditLog, AuditLogSchema, type AuditLogDocument } from './audit-log.schema';
import { AuditLoggerService } from './audit-logger.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: AuditLog.name, schema: AuditLogSchema }])],
  providers: [
    {
      provide: AuditLoggerService,
      inject: [getModelToken(AuditLog.name)],
      useFactory: (model: Model<AuditLogDocument>) => new AuditLoggerService(model),
    },
  ],
  exports: [AuditLoggerService],
})
export class AuditModule {}
