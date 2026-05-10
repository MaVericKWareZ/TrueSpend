import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export interface ResetTokenSubject {
  passwordResetToken?: string;
  passwordResetExpiresAt?: Date;
}

export interface GeneratedResetToken {
  raw: string;
  hashed: string;
  expiresAt: Date;
}

export const NOW_PROVIDER = Symbol.for('ResetTokenService.now');
export type NowProvider = () => Date;

@Injectable()
export class ResetTokenService {
  constructor(
    private readonly ttlMinutes: number,
    @Inject(NOW_PROVIDER) private readonly now: NowProvider,
  ) {}

  generate(): GeneratedResetToken {
    const raw = randomBytes(32).toString('hex');
    const hashed = this.hashRaw(raw);
    const expiresAt = new Date(this.now().getTime() + this.ttlMinutes * 60_000);
    return { raw, hashed, expiresAt };
  }

  hashRaw(raw: string): string {
    return createHash('sha256').update(raw, 'utf8').digest('hex');
  }

  isValid(subject: ResetTokenSubject, raw: string, now: Date): boolean {
    const stored = subject.passwordResetToken;
    const expiresAt = subject.passwordResetExpiresAt;
    if (!stored || !expiresAt) return false;
    if (expiresAt.getTime() <= now.getTime()) return false;

    const computed = this.hashRaw(raw);
    if (computed.length !== stored.length) return false;
    return timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(stored, 'hex'));
  }
}

export const resetTokenServiceFactory = (config: ConfigService, now: NowProvider) =>
  new ResetTokenService(config.getOrThrow<number>('RESET_TOKEN_TTL_MINUTES'), now);
