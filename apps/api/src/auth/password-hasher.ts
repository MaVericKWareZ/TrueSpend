import { Injectable, Logger } from '@nestjs/common';
import argon2 from 'argon2';

export const ARGON2_PARAMS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

@Injectable()
export class PasswordHasher {
  private readonly logger = new Logger(PasswordHasher.name);

  hash(plain: string): Promise<string> {
    return argon2.hash(plain, {
      type: argon2.argon2id,
      memoryCost: ARGON2_PARAMS.memoryCost,
      timeCost: ARGON2_PARAMS.timeCost,
      parallelism: ARGON2_PARAMS.parallelism,
    });
  }

  async verify(plain: string, encoded: string): Promise<boolean> {
    try {
      return await argon2.verify(encoded, plain);
    } catch (err) {
      this.logger.debug(
        `argon2 verify rejected malformed encoded hash: ${(err as Error).message}`,
      );
      return false;
    }
  }
}
