import {createHash, randomInt, timingSafeEqual} from 'node:crypto';

// Password-reset one-time codes.
//
// A six-digit code is only a million possibilities, so its safety comes from
// the limits around it rather than from its length. Three of them live here and
// the fourth (the per-IP request cap) lives in the rate limiter:
//
//   TTL          — 10 minutes. The old emailed link lived an hour; a code the
//                  user is reading off their screen does not need that long,
//                  and every extra minute is guessing time.
//   ATTEMPTS     — 5 wrong tries burn the code. Persisted on the row, NOT in
//                  the process's rate-limiter memory, so a restart cannot hand
//                  an attacker a fresh budget.
//   ONE LIVE     — issuing a code deletes the user's previous ones, so there is
//                  never more than a single valid code per account at a time.

export const OTP_TTL_MS = 10 * 60 * 1000;
export const MAX_OTP_ATTEMPTS = 5;
export const OTP_LENGTH = 6;

/** Scalar guard for the client-supplied code: exactly six digits, nothing else. */
export const OTP_PATTERN = /^\d{6}$/;

/**
 * randomInt, not Math.random: this is a credential. It is also rejection-free
 * and uniform over the whole range, so 000000 and 999999 are as likely as any
 * other value — a modulo of a random buffer would have skewed the low end.
 */
export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(OTP_LENGTH, '0');
}

/**
 * Codes are stored HASHED, so a leaked PasswordResetToken table yields nothing
 * usable. The USER ID is mixed in for two reasons: tokenHash carries a UNIQUE
 * constraint, and with only a million possible codes two users holding the same
 * one at the same time is not a rare event — hashing the code alone would make
 * that a write failure. It also means a stolen hash cannot be tried against
 * another account.
 */
export function hashOtp(userId: string, code: string): string {
  return createHash('sha256').update(`${userId}.${code}`).digest('hex');
}

/**
 * Constant-time compare of two hex digests. The DB lookup is by hash, so this
 * guards the one place a caller might otherwise compare with === and leak
 * position information through timing.
 */
export function hashesEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Groups the code for the email body: 123456 -> "123 456". */
export function formatOtpForDisplay(code: string): string {
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}
