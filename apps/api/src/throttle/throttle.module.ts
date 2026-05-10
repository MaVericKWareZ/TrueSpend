import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, Reflector } from '@nestjs/core';
import {
  ThrottlerModule,
  ThrottlerStorageService,
  getOptionsToken,
  getStorageToken,
  type ThrottlerModuleOptions,
} from '@nestjs/throttler';

import { FLY_THROTTLER_OPTIONS, FlyThrottlerGuard, type FlyThrottlerOptions } from './fly-throttler-guard';

/**
 * Each auth route has its own per-IP rate limit; we encode them as a single
 * default throttler whose settings are overridden per-route via {@link Throttle}.
 * Using one bucket means {@link Throttle} on a route uniquely scopes the limit
 * to that route — the default for other routes (10_000 req / 15 min) effectively
 * disables global limiting outside the auth controller.
 */
export const THROTTLE_TIER = {
  default: 'default',
} as const;

@Module({
  imports: [
    ConfigModule,
    ThrottlerModule.forRoot({
      throttlers: [
        { name: THROTTLE_TIER.default, limit: 10_000, ttl: 15 * 60_000 },
      ],
    } satisfies ThrottlerModuleOptions),
  ],
  providers: [
    {
      provide: FLY_THROTTLER_OPTIONS,
      inject: [ConfigService],
      useFactory: (config: ConfigService): FlyThrottlerOptions => ({
        throttleDisabled: config.getOrThrow<boolean>('THROTTLE_DISABLED'),
      }),
    },
    {
      provide: APP_GUARD,
      inject: [getOptionsToken(), getStorageToken(), Reflector, FLY_THROTTLER_OPTIONS],
      useFactory: (
        options: ThrottlerModuleOptions,
        storage: ThrottlerStorageService,
        reflector: Reflector,
        flyOptions: FlyThrottlerOptions,
      ) => new FlyThrottlerGuard(options, storage, reflector, flyOptions),
    },
  ],
})
export class ThrottleModule {}
