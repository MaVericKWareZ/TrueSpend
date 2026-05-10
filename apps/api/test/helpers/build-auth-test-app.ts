import {
  MiddlewareConsumer,
  Module,
  type INestApplication,
  type NestModule,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose';
import { Test, type TestingModule } from '@nestjs/testing';
import mongoose from 'mongoose';
import { vi, type Mock } from 'vitest';

import { AuditModule } from '../../src/audit/audit.module';
import { AuthBridge } from '../../src/auth/auth-bridge.middleware';
import { AuthModule } from '../../src/auth/auth.module';
import { PUBLIC_AUTH_ROUTES } from '../../src/auth/public-auth-routes';
import { validateEnv } from '../../src/config/env';
import { MailerModule } from '../../src/mailer/mailer.module';
import { MAILER, type Mailer } from '../../src/mailer/mailer.port';
import { ThrottleModule } from '../../src/throttle/throttle.module';
import { UsersModule } from '../../src/users/users.module';
import { startInMemoryMongo, stopInMemoryMongo } from './mongo-memory';

@Module({
  imports: [AuditModule, MailerModule, ThrottleModule, UsersModule, AuthModule],
})
class TestRootModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AuthBridge).exclude(...PUBLIC_AUTH_ROUTES).forRoutes('*');
  }
}

export interface TestAppOptions {
  dbName: string;
  jwtSecret?: string;
  publicAppUrl?: string;
  throttleDisabled?: boolean;
}

export type MailerSendArgs = { to: string; subject: string; text: string; html?: string };
export type MailerSendMock = Mock<[MailerSendArgs], Promise<void>>;

export interface TestAppHandle {
  app: INestApplication;
  moduleRef: TestingModule;
  mailerSend: MailerSendMock;
  cleanupCollections: () => Promise<void>;
  close: () => Promise<void>;
}

export async function buildAuthTestApp(options: TestAppOptions): Promise<TestAppHandle> {
  const uri = await startInMemoryMongo(options.dbName);
  process.env.MONGODB_URI = uri;
  process.env.JWT_SECRET = options.jwtSecret ?? 'test-secret-with-min-16-chars-here';
  process.env.PORT = '3001';
  process.env.NODE_ENV = 'test';
  process.env.MAILER_DRIVER = 'console';
  process.env.RESET_TOKEN_TTL_MINUTES = '60';
  process.env.THROTTLE_DISABLED = String(options.throttleDisabled ?? true);
  process.env.PUBLIC_APP_URL = options.publicAppUrl ?? 'http://localhost:3000';

  const mailerSend: MailerSendMock = vi.fn(async (_args: MailerSendArgs) => {});
  const mailerSpy: Mailer = { send: mailerSend };

  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        validate: validateEnv,
      }),
      MongooseModule.forRoot(uri),
      TestRootModule,
    ],
  })
    .overrideProvider(MAILER)
    .useValue(mailerSpy)
    .compile();

  const app = moduleRef.createNestApplication();
  await app.init();

  return {
    app,
    moduleRef,
    mailerSend,
    cleanupCollections: async () => {
      const conn = moduleRef.get(getConnectionToken());
      const db = conn.db;
      if (!db) return;
      const collections = await db.collections();
      for (const c of collections) {
        await c.deleteMany({});
      }
    },
    close: async () => {
      await app.close();
      await mongoose.disconnect();
      await stopInMemoryMongo();
    },
  };
}
