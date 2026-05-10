import {
  Controller,
  Get,
  HttpCode,
  MiddlewareConsumer,
  Module,
  type NestModule,
  Post,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AuthBridge, JWT_SECRET_TOKEN } from './auth-bridge.middleware';
import { PUBLIC_AUTH_ROUTES } from './public-auth-routes';

@Controller()
class StubController {
  @Post('auth/signup')
  @HttpCode(200)
  signup() {
    return { ok: 'signup' };
  }

  @Post('auth/credentials-verify')
  @HttpCode(200)
  verify() {
    return { ok: 'verify' };
  }

  @Post('auth/forgot-password')
  @HttpCode(200)
  forgot() {
    return { ok: 'forgot' };
  }

  @Post('auth/reset-password')
  @HttpCode(200)
  reset() {
    return { ok: 'reset' };
  }

  @Get('auth/protected')
  protectedRoute() {
    return { ok: 'protected' };
  }

  @Get('health')
  health() {
    return { status: 'ok' };
  }
}

@Module({
  controllers: [StubController],
  providers: [
    AuthBridge,
    {
      provide: JWT_SECRET_TOKEN,
      useValue: 'test-secret-min-16-characters-long',
    },
  ],
})
class TestExclusionModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AuthBridge).exclude(...PUBLIC_AUTH_ROUTES).forRoutes('*');
  }
}

describe('AuthBridge exclusion', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TestExclusionModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([
    ['/auth/signup'],
    ['/auth/credentials-verify'],
    ['/auth/forgot-password'],
    ['/auth/reset-password'],
  ])('POST %s reaches the handler without an Authorization header', async (path) => {
    const res = await request(app.getHttpServer()).post(path).send({});
    expect(res.status).toBe(200);
  });

  it('GET /auth/protected returns 401 (exclusion is path+method specific)', async () => {
    const res = await request(app.getHttpServer()).get('/auth/protected');
    expect(res.status).toBe(401);
  });

  it('GET /health returns 401 without Authorization (regression: AuthBridge intact)', async () => {
    const res = await request(app.getHttpServer()).get('/health');
    expect(res.status).toBe(401);
  });
});
