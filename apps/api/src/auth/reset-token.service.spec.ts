import { createHash } from 'node:crypto';
import { describe, it, expect } from 'vitest';

import { ResetTokenService, type ResetTokenSubject } from './reset-token.service';

const sha256Hex = (raw: string): string =>
  createHash('sha256').update(raw, 'utf8').digest('hex');

const fixedNow = (iso: string): (() => Date) => () => new Date(iso);

describe('ResetTokenService', () => {
  describe('generate', () => {
    it('returns a 64-char hex raw token', () => {
      const svc = new ResetTokenService(60, () => new Date());
      const { raw } = svc.generate();
      expect(raw).toMatch(/^[a-f0-9]{64}$/);
    });

    it('returns a SHA-256 hash of the raw token as `hashed`', () => {
      const svc = new ResetTokenService(60, () => new Date());
      const { raw, hashed } = svc.generate();
      expect(hashed).toBe(sha256Hex(raw));
    });

    it('returns expiresAt = now + ttlMinutes (in ms)', () => {
      const svc = new ResetTokenService(60, fixedNow('2026-05-10T12:00:00.000Z'));
      const { expiresAt } = svc.generate();
      expect(expiresAt.toISOString()).toBe('2026-05-10T13:00:00.000Z');
    });

    it('respects a custom ttlMinutes value', () => {
      const svc = new ResetTokenService(15, fixedNow('2026-05-10T12:00:00.000Z'));
      const { expiresAt } = svc.generate();
      expect(expiresAt.toISOString()).toBe('2026-05-10T12:15:00.000Z');
    });

    it('produces distinct raw and hashed values across calls', () => {
      const svc = new ResetTokenService(60, () => new Date());
      const a = svc.generate();
      const b = svc.generate();
      expect(a.raw).not.toBe(b.raw);
      expect(a.hashed).not.toBe(b.hashed);
    });
  });

  describe('hashRaw', () => {
    it('is deterministic and matches the SHA-256 of the input', () => {
      const svc = new ResetTokenService(60, () => new Date());
      const raw = 'abcdef';
      expect(svc.hashRaw(raw)).toBe(sha256Hex(raw));
      expect(svc.hashRaw(raw)).toBe(svc.hashRaw(raw));
    });

    it('matches what generate() returns as `hashed`', () => {
      const svc = new ResetTokenService(60, () => new Date());
      const { raw, hashed } = svc.generate();
      expect(svc.hashRaw(raw)).toBe(hashed);
    });
  });

  describe('isValid', () => {
    const svc = new ResetTokenService(60, () => new Date());

    it('returns true when hash matches and expiresAt is in the future', () => {
      const raw = 'token-raw';
      const subject: ResetTokenSubject = {
        passwordResetToken: svc.hashRaw(raw),
        passwordResetExpiresAt: new Date('2026-05-10T13:00:00.000Z'),
      };
      const now = new Date('2026-05-10T12:00:00.000Z');
      expect(svc.isValid(subject, raw, now)).toBe(true);
    });

    it('returns false when expiresAt has passed', () => {
      const raw = 'token-raw';
      const subject: ResetTokenSubject = {
        passwordResetToken: svc.hashRaw(raw),
        passwordResetExpiresAt: new Date('2026-05-10T12:00:00.000Z'),
      };
      const now = new Date('2026-05-10T13:00:00.000Z');
      expect(svc.isValid(subject, raw, now)).toBe(false);
    });

    it('returns false when expiresAt equals now (strict greater-than)', () => {
      const raw = 'token-raw';
      const subject: ResetTokenSubject = {
        passwordResetToken: svc.hashRaw(raw),
        passwordResetExpiresAt: new Date('2026-05-10T12:00:00.000Z'),
      };
      const now = new Date('2026-05-10T12:00:00.000Z');
      expect(svc.isValid(subject, raw, now)).toBe(false);
    });

    it('returns false when the hash does not match', () => {
      const subject: ResetTokenSubject = {
        passwordResetToken: svc.hashRaw('different-token'),
        passwordResetExpiresAt: new Date('2026-05-10T13:00:00.000Z'),
      };
      const now = new Date('2026-05-10T12:00:00.000Z');
      expect(svc.isValid(subject, 'token-raw', now)).toBe(false);
    });

    it('returns false when the subject has no token (cleared after use)', () => {
      const subject: ResetTokenSubject = {
        passwordResetToken: undefined,
        passwordResetExpiresAt: undefined,
      };
      expect(svc.isValid(subject, 'token-raw', new Date())).toBe(false);
    });

    it('returns false when only one of the two fields is set', () => {
      const subject: ResetTokenSubject = {
        passwordResetToken: svc.hashRaw('x'),
        passwordResetExpiresAt: undefined,
      };
      expect(svc.isValid(subject, 'x', new Date())).toBe(false);
    });
  });
});
