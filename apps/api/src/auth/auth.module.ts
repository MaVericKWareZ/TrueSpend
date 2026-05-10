import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuditModule } from '../audit/audit.module';
import { MailerModule } from '../mailer/mailer.module';
import { UsersModule } from '../users/users.module';
import { AuthBridge, JWT_SECRET_TOKEN } from './auth-bridge.middleware';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordHasher } from './password-hasher';
import { NOW_PROVIDER, ResetTokenService } from './reset-token.service';

@Module({
  imports: [ConfigModule, UsersModule, MailerModule, AuditModule],
  controllers: [AuthController],
  providers: [
    {
      provide: JWT_SECRET_TOKEN,
      inject: [ConfigService],
      useFactory: (config: ConfigService): string => config.getOrThrow<string>('JWT_SECRET'),
    },
    AuthBridge,
    PasswordHasher,
    {
      provide: NOW_PROVIDER,
      useValue: () => new Date(),
    },
    {
      provide: ResetTokenService,
      inject: [ConfigService, NOW_PROVIDER],
      useFactory: (config: ConfigService, now: () => Date) =>
        new ResetTokenService(config.getOrThrow<number>('RESET_TOKEN_TTL_MINUTES'), now),
    },
    AuthService,
  ],
  exports: [AuthBridge, JWT_SECRET_TOKEN, AuthService],
})
export class AuthModule {}
