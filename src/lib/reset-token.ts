import {createHash, randomBytes} from 'node:crypto';

// Password-reset token helpers (Phase 4 plan binding): raw tokens are 32
// random bytes hex-encoded (64 lowercase hex chars), live for 1 hour, and are
// stored HASHED at rest (sha256 hex) — a leaked PasswordResetToken table never
// yields a usable link.

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

// Scalar guard for client-supplied tokens (URL segment + action argument):
// exactly what randomBytes(32).toString('hex') can produce, nothing else.
export const RESET_TOKEN_PATTERN = /^[0-9a-f]{64}$/;

export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateResetToken(): {token: string; tokenHash: string} {
  const token = randomBytes(32).toString('hex');
  return {token, tokenHash: hashResetToken(token)};
}
