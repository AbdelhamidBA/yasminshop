'use server';

import {failure, fieldErrorsFromZod, success, type ActionResult} from '@/lib/action-result';
import {prisma} from '@/lib/db';
import {hashPassword} from '@/lib/password';
import {
  RESET_TOKEN_PATTERN,
  RESET_TOKEN_TTL_MS,
  generateResetToken,
  hashResetToken
} from '@/lib/reset-token';
import {newPasswordSchema} from '@/lib/schemas/auth';

// Both actions are public (the proxy only guards /admin).

// Sentinel thrown INSIDE the reset transaction to abort it (orders-actions
// idiom): any throw rolls the whole transaction back, so the token can never
// be burned without the password actually changing (or vice versa).
class ResetAbort extends Error {
  constructor() {
    super('invalidToken');
    this.name = 'ResetAbort';
  }
}

// Step 1 — request a reset link. ALWAYS returns success(undefined), whatever
// the input: whether the email exists, is malformed, or belongs to an
// archived account must be unobservable from the response (no account-
// existence oracle — plan binding). The token itself is stored HASHED; the
// raw value only ever appears in the delivery channel.
export async function requestPasswordReset(
  _prevState: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const email = String(formData.get('email') ?? '').trim();
  // Scalar-guarded locale for the URL prefix only — allowlist, fallback 'fr'.
  const locale = formData.get('locale') === 'ar' ? 'ar' : 'fr';

  // Exact-match lookup, mirroring authorize() in src/auth.ts (emails are
  // stored and compared verbatim). Bounded to keep the query sane.
  if (email.length > 0 && email.length <= 254) {
    const user = await prisma.user.findUnique({
      where: {email},
      select: {id: true, archivedAt: true}
    });
    // Archived accounts cannot log in (authorize() rejects them) — minting a
    // reset link for one would be a side door, so they get none.
    if (user && user.archivedAt === null) {
      const {token, tokenHash} = generateResetToken();
      await prisma.passwordResetToken.create({
        data: {userId: user.id, tokenHash, expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS)}
      });
      // DEV delivery channel (plan §Task 7): the reset URL goes to the server
      // console. Production needs real email delivery (SMTP — spec §7); swap
      // this log for a send when that lands. The raw token is intentionally
      // never persisted or returned to the browser.
      const base = process.env.APP_URL ?? 'http://localhost:3000';
      console.log(`[password-reset] Reset URL for ${email}: ${base}/${locale}/reset-password/${token}`);
    }
  }
  return success(undefined);
}

// Step 2 — consume a token. EVERY invalid case (bad shape, unknown hash,
// expired, already used, archived owner, lost race) collapses to the same
// generic 'invalidToken' failure: no detail that would let a caller probe
// token state. Field-level keys are only surfaced for the NEW password's own
// validation.
export async function resetPassword(token: string, formData: FormData): Promise<ActionResult> {
  if (typeof token !== 'string' || !RESET_TOKEN_PATTERN.test(token)) {
    return failure('invalidToken');
  }

  const parsed = newPasswordSchema.safeParse({
    password: String(formData.get('password') ?? ''),
    confirmPassword: String(formData.get('confirmPassword') ?? '')
  });
  if (!parsed.success) return failure('validation', fieldErrorsFromZod(parsed.error));

  const now = new Date();
  const row = await prisma.passwordResetToken.findUnique({
    where: {tokenHash: hashResetToken(token)},
    select: {id: true, expiresAt: true, usedAt: true, user: {select: {id: true, archivedAt: true}}}
  });
  if (!row || row.usedAt !== null || row.expiresAt <= now || row.user.archivedAt !== null) {
    return failure('invalidToken');
  }

  const passwordHash = await hashPassword(parsed.data.password);
  try {
    // Single transaction (plan binding): burning the token and writing the
    // new hash commit together. The conditional updateMany re-states
    // unused+unexpired in the WHERE — a concurrent consume of the same token
    // makes count 0 and aborts, so the token is strictly single-use.
    await prisma.$transaction(async (tx) => {
      const updated = await tx.passwordResetToken.updateMany({
        where: {id: row.id, usedAt: null, expiresAt: {gt: now}},
        data: {usedAt: now}
      });
      if (updated.count === 0) throw new ResetAbort();
      await tx.user.update({where: {id: row.user.id}, data: {passwordHash}});
    });
  } catch (error) {
    if (error instanceof ResetAbort) return failure('invalidToken');
    throw error;
  }
  return success(undefined);
}
