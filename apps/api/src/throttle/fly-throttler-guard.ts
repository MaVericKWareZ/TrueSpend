import { HttpException, Injectable, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ThrottlerGuard,
  ThrottlerStorage,
  type ThrottlerLimitDetail,
  type ThrottlerModuleOptions,
} from '@nestjs/throttler';

export interface FlyThrottlerOptions {
  throttleDisabled: boolean;
}

export const FLY_THROTTLER_OPTIONS = Symbol.for('FlyThrottlerOptions');

@Injectable()
export class FlyThrottlerGuard extends ThrottlerGuard {
  constructor(
    options: ThrottlerModuleOptions,
    storage: ThrottlerStorage,
    reflector: Reflector,
    private readonly flyOptions: FlyThrottlerOptions,
  ) {
    super(options, storage, reflector);
  }

  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const headers = (req.headers ?? {}) as Record<string, string | string[] | undefined>;
    const raw = headers['fly-client-ip'];
    const headerValue = Array.isArray(raw) ? raw[0] : raw;
    if (typeof headerValue === 'string' && headerValue.length > 0) {
      const first = headerValue.split(',')[0]?.trim();
      if (first) return first;
    }
    return (req.ip as string) ?? 'unknown';
  }

  protected override async shouldSkip(): Promise<boolean> {
    return this.flyOptions.throttleDisabled;
  }

  protected override async throwThrottlingException(
    _context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    const retryAfterSeconds = Math.max(1, Math.ceil(detail.timeToBlockExpire ?? detail.ttl / 1000));
    throw new HttpException(
      { error: 'rate_limited', retryAfterSeconds },
      429,
    );
  }
}
