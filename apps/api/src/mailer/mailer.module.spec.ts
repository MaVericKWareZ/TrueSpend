import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { ConsoleMailer } from './console-mailer';
import { MAILER, type Mailer } from './mailer.port';
import { MailerModule } from './mailer.module';

const buildConfigModule = (driver: string) =>
  ConfigModule.forRoot({
    isGlobal: true,
    ignoreEnvFile: true,
    load: [() => ({ MAILER_DRIVER: driver })],
  });

describe('MailerModule', () => {
  it('resolves MAILER to a ConsoleMailer when MAILER_DRIVER=console', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [buildConfigModule('console'), MailerModule],
    }).compile();

    const mailer = moduleRef.get<Mailer>(MAILER);
    expect(mailer).toBeInstanceOf(ConsoleMailer);
    await moduleRef.close();
  });

  it('throws when MAILER_DRIVER is unsupported', async () => {
    await expect(
      Test.createTestingModule({
        imports: [buildConfigModule('not-a-driver'), MailerModule],
      }).compile(),
    ).rejects.toThrow(/MAILER_DRIVER/);
  });

  it('reads MAILER_DRIVER from ConfigService at resolution time', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [buildConfigModule('console'), MailerModule],
    }).compile();

    const config = moduleRef.get(ConfigService);
    expect(config.get('MAILER_DRIVER')).toBe('console');
    await moduleRef.close();
  });
});
