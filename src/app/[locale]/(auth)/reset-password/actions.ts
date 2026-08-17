'use server';

import {headers} from 'next/headers';
import {failure, fieldErrorsFromZod, success, type ActionResult} from '@/lib/action-result';
import {prisma} from '@/lib/db';
import {sendMail} from '@/lib/mailer';
import {
  MAX_OTP_ATTEMPTS,
  OTP_TTL_MS,
  formatOtpForDisplay,
  generateOtp,
  hashOtp
} from '@/lib/otp';
import {hashPassword} from '@/lib/password';
import {RATE_LIMITS, clientIpFromHeaders, enforceRateLimit} from '@/lib/rate-limit';
import {otpResetSchema} from '@/lib/schemas/auth';

// Both actions are public (the proxy only guards /admin).
//
// The reset proof is a six-digit code mailed to the address on file, replacing
// the emailed link this flow used to log to the server console. A code needs no
// delivery URL, survives being read off a phone screen, and — unlike a link —
// cannot be leaked by a referrer header or a shared browser history entry.
// src/lib/otp.ts holds the limits that make six digits safe.

// Sentinel thrown INSIDE the reset transaction to abort it (orders-actions
// idiom): any throw rolls the whole transaction back, so a code can never be
// spent without the password actually changing, nor the reverse.
class ResetAbort extends Error {
  constructor() {
    super('invalidCode');
    this.name = 'ResetAbort';
  }
}

/**
 * Step 1 — ask for a code.
 *
 * ALWAYS returns success(undefined), whatever the input: whether the address
 * exists, is malformed, or belongs to an archived account must be unobservable
 * from the response. That includes delivery failure — a bounced send answers
 * exactly like a delivered one.
 */
export async function requestPasswordReset(
  _prevState: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  // Rate-limit by client IP BEFORE any DB work — this is an unauthenticated
  // public write that mints a credential and sends mail. Over-limit collapses
  // to a typed failure; the form treats it like any other non-field error.
  const ip = clientIpFromHeaders(await headers());
  if (
    !enforceRateLimit(
      `password-reset:${ip}`,
      RATE_LIMITS.passwordReset.limit,
      RATE_LIMITS.passwordReset.windowMs
    ).allowed
  ) {
    return failure('rateLimited');
  }

  const email = String(formData.get('email') ?? '').trim();

  // Exact-match lookup, mirroring authorize() in src/auth.ts (e-mails are
  // stored and compared verbatim). Bounded to keep the query sane.
  if (email.length > 0 && email.length <= 254) {
    const user = await prisma.user.findUnique({
      where: {email},
      select: {id: true, name: true, archivedAt: true}
    });
    // Archived accounts cannot sign in (authorize() rejects them), so minting a
    // reset code for one would be a side door. They get none — and the caller
    // still sees success.
    if (user && user.archivedAt === null) {
      const code = generateOtp();
      const expiresAt = new Date(Date.now() + OTP_TTL_MS);

      await prisma.$transaction(async (tx) => {
        // DELETE rather than mark-used: it guarantees at most one live code per
        // account (asking again invalidates the previous code), and it keeps the
        // UNIQUE tokenHash column clear of spent rows that a future code could
        // collide with — only a million values exist.
        await tx.passwordResetToken.deleteMany({where: {userId: user.id}});
        await tx.passwordResetToken.create({
          data: {userId: user.id, tokenHash: hashOtp(user.id, code), expiresAt}
        });
      });

      // The settings carry no shop NAME (only a description), and the brand is
      // fixed in the letterhead, the invoice and the wordmark — so it is a
      // constant here too rather than an invented setting.
      const shop = 'Yasmine Shop';
      const minutes = Math.round(OTP_TTL_MS / 60000);
      // Awaited so a slow SMTP server cannot let the request finish before the
      // send is even attempted (a serverless-style teardown would drop it).
      // sendMail never throws; its result deliberately does not change ours.
      await sendMail({
        to: email,
        subject: `${shop} — code de réinitialisation : ${code}`,
        text: [
          `Bonjour ${user.name},`,
          '',
          `Voici votre code de réinitialisation ${shop} :`,
          '',
          `    ${formatOtpForDisplay(code)}`,
          '',
          `Ce code est valable ${minutes} minutes et ne peut servir qu'une fois.`,
          "Si vous n'avez pas demandé de réinitialisation, ignorez ce message :",
          'votre mot de passe reste inchangé.',
          '',
          shop
        ].join('\n'),
        html: resetEmailHtml({shop, name: user.name, code, minutes})
      });
    }
  }
  return success(undefined);
}

/** Plain, table-based markup — mail clients are not browsers. */
function resetEmailHtml({
  shop,
  name,
  code,
  minutes
}: {
  shop: string;
  name: string;
  code: string;
  minutes: number;
}): string {
  const escape = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<!doctype html>
<html lang="fr"><body style="margin:0;padding:24px;background:#f7f3ea;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#2c2924;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
    <tr><td>
      <p style="margin:0 0 4px;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#6b6459;">${escape(shop)}</p>
      <h1 style="margin:0 0 20px;font-size:20px;">Réinitialisation du mot de passe</h1>
      <p style="margin:0 0 16px;font-size:15px;">Bonjour ${escape(name)},</p>
      <p style="margin:0 0 20px;font-size:15px;">Voici votre code de réinitialisation :</p>
      <p style="margin:0 0 20px;font-size:32px;font-weight:700;letter-spacing:.18em;text-align:center;background:#f7f3ea;border-radius:8px;padding:16px;">${escape(formatOtpForDisplay(code))}</p>
      <p style="margin:0 0 12px;font-size:14px;color:#6b6459;">Ce code est valable ${minutes} minutes et ne peut servir qu'une seule fois.</p>
      <p style="margin:0;font-size:14px;color:#6b6459;">Si vous n'avez pas demandé de réinitialisation, ignorez ce message : votre mot de passe reste inchangé.</p>
    </td></tr>
  </table>
</body></html>`;
}

/**
 * Step 2 — spend the code and set the new password.
 *
 * EVERY reason a well-formed code can be refused — unknown address, no code
 * outstanding, wrong code, expired, already spent, attempts exhausted, archived
 * owner — collapses to the same generic 'invalidCode'. Field-level keys are
 * surfaced only for the NEW password's own validation, which reveals nothing
 * about account state.
 */
export async function resetPasswordWithOtp(formData: FormData): Promise<ActionResult> {
  const ip = clientIpFromHeaders(await headers());
  if (
    !enforceRateLimit(
      `password-reset-verify:${ip}`,
      RATE_LIMITS.passwordResetVerify.limit,
      RATE_LIMITS.passwordResetVerify.windowMs
    ).allowed
  ) {
    return failure('rateLimited');
  }

  const parsed = otpResetSchema.safeParse({
    email: String(formData.get('email') ?? ''),
    code: String(formData.get('code') ?? ''),
    password: String(formData.get('password') ?? ''),
    confirmPassword: String(formData.get('confirmPassword') ?? '')
  });
  if (!parsed.success) return failure('validation', fieldErrorsFromZod(parsed.error));

  const {email, code, password} = parsed.data;
  const user = await prisma.user.findUnique({
    where: {email},
    select: {id: true, archivedAt: true}
  });
  if (!user || user.archivedAt !== null) return failure('invalidCode');

  const now = new Date();
  // The lookup IS the comparison: the row is found by hash, so a wrong code
  // simply finds nothing. There is no stored value to compare against and
  // therefore no timing side channel in this path.
  const row = await prisma.passwordResetToken.findUnique({
    where: {tokenHash: hashOtp(user.id, code)},
    select: {id: true, userId: true, expiresAt: true, usedAt: true, attempts: true}
  });

  if (!row || row.userId !== user.id) {
    // A wrong code still costs the user an attempt on their OUTSTANDING code —
    // otherwise the cap would be trivially bypassed by simply guessing wrong,
    // which by definition is what an attacker does.
    await prisma.passwordResetToken.updateMany({
      where: {userId: user.id, usedAt: null},
      data: {attempts: {increment: 1}}
    });
    await prisma.passwordResetToken.deleteMany({
      where: {userId: user.id, attempts: {gte: MAX_OTP_ATTEMPTS}}
    });
    return failure('invalidCode');
  }

  if (row.usedAt !== null || row.expiresAt <= now || row.attempts >= MAX_OTP_ATTEMPTS) {
    return failure('invalidCode');
  }

  const passwordHash = await hashPassword(password);
  try {
    await prisma.$transaction(async (tx) => {
      // Conditional updateMany re-states every precondition in the WHERE: a
      // concurrent use of the same code makes this count 0 and aborts, so a
      // code is strictly single-use even under a race.
      const spent = await tx.passwordResetToken.updateMany({
        where: {
          id: row.id,
          usedAt: null,
          expiresAt: {gt: now},
          attempts: {lt: MAX_OTP_ATTEMPTS}
        },
        data: {usedAt: now}
      });
      if (spent.count === 0) throw new ResetAbort();
      // Rotate the password AND bump tokenVersion together: a live JWT session
      // issued before the reset no longer matches the DB version, so it is
      // revoked on the next protected navigation. A stolen session dies the
      // instant the owner resets.
      await tx.user.update({
        where: {id: user.id},
        data: {passwordHash, tokenVersion: {increment: 1}}
      });
      // Nothing outstanding survives a completed reset.
      await tx.passwordResetToken.deleteMany({where: {userId: user.id}});
    });
  } catch (error) {
    if (error instanceof ResetAbort) return failure('invalidCode');
    throw error;
  }
  return success(undefined);
}
