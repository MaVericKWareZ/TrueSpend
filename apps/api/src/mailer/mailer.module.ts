import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { ConsoleMailer } from './console-mailer';
import { MAILER, type Mailer } from './mailer.port';

@Module({
  imports: [ConfigModule],
  providers: [
    ConsoleMailer,
    {
      provide: MAILER,
      inject: [ConfigService, ConsoleMailer],
      useFactory: (config: ConfigService, consoleMailer: ConsoleMailer): Mailer => {
        const driver = config.getOrThrow<string>('MAILER_DRIVER');
        if (driver === 'console') return consoleMailer;
        throw new Error(`Unsupported MAILER_DRIVER: ${driver}`);
      },
    },
  ],
  exports: [MAILER],
})
export class MailerModule {}
