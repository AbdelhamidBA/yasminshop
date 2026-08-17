import {describe, expect, test} from 'vitest';
import {
  MAX_OTP_ATTEMPTS,
  OTP_LENGTH,
  OTP_PATTERN,
  OTP_TTL_MS,
  formatOtpForDisplay,
  generateOtp,
  hashOtp,
  hashesEqual
} from './otp';

describe('generateOtp', () => {
  test('always six digits, including the values with leading zeros', () => {
    for (let i = 0; i < 2000; i += 1) {
      const code = generateOtp();
      expect(code).toHaveLength(OTP_LENGTH);
      expect(OTP_PATTERN.test(code)).toBe(true);
    }
  });

  test('covers the range rather than clustering', () => {
    // A weak generator (modulo of a byte, say) would never reach the top of the
    // range. 2000 draws over a million values should still spread across it.
    const values = Array.from({length: 2000}, () => Number(generateOtp()));
    expect(Math.min(...values)).toBeLessThan(200_000);
    expect(Math.max(...values)).toBeGreaterThan(800_000);
    // And it must not be constant.
    expect(new Set(values).size).toBeGreaterThan(1900);
  });
});

describe('hashOtp', () => {
  test('is deterministic and hex', () => {
    expect(hashOtp('user1', '123456')).toBe(hashOtp('user1', '123456'));
    expect(hashOtp('user1', '123456')).toMatch(/^[0-9a-f]{64}$/);
  });

  test('never returns the code itself', () => {
    expect(hashOtp('user1', '123456')).not.toContain('123456');
  });

  test('the SAME code for two users hashes differently', () => {
    // This is what lets the unique tokenHash column hold concurrent codes: with
    // only a million values, a collision between two users is not exotic.
    expect(hashOtp('user1', '123456')).not.toBe(hashOtp('user2', '123456'));
  });

  test('different codes for the same user hash differently', () => {
    expect(hashOtp('user1', '123456')).not.toBe(hashOtp('user1', '123457'));
  });
});

describe('hashesEqual', () => {
  test('matches identical digests and rejects everything else', () => {
    const digest = hashOtp('user1', '123456');
    expect(hashesEqual(digest, digest)).toBe(true);
    expect(hashesEqual(digest, hashOtp('user1', '654321'))).toBe(false);
    // Different lengths must return false rather than throw — timingSafeEqual
    // does throw on a length mismatch, so the guard has to come first.
    expect(hashesEqual(digest, 'short')).toBe(false);
    expect(hashesEqual('', '')).toBe(true);
  });
});

describe('formatOtpForDisplay', () => {
  test('groups the digits without altering them', () => {
    expect(formatOtpForDisplay('123456')).toBe('123 456');
    expect(formatOtpForDisplay('000123')).toBe('000 123');
    expect(formatOtpForDisplay('123456').replace(' ', '')).toBe('123456');
  });
});

describe('policy constants', () => {
  test('are the values the flow documents', () => {
    expect(OTP_TTL_MS).toBe(10 * 60 * 1000);
    expect(MAX_OTP_ATTEMPTS).toBe(5);
  });

  test('the pattern rejects anything that is not six digits', () => {
    for (const bad of ['', '12345', '1234567', 'abcdef', '12 456', '12345a', '-12345']) {
      expect(OTP_PATTERN.test(bad)).toBe(false);
    }
    expect(OTP_PATTERN.test('000000')).toBe(true);
  });
});
