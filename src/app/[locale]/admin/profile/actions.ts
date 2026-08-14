'use server';

import {signOut} from '@/auth';
import {routing} from '@/i18n/routing';
import {failure, fieldErrorsFromZod, success, type ActionResult} from '@/lib/action-result';
import {AuthzError} from '@/lib/authz';
import {prisma} from '@/lib/db';
import {hashPassword, verifyPassword} from '@/lib/password';
import {RATE_LIMITS, enforceRateLimit} from '@/lib/rate-limit';
import {changePasswordSchema} from '@/lib/schemas/auth';
import {requireStaff} from '@/server/authz';

/**
 * A staff member changes their OWN password.
 *
 * Open to ADMIN and SUB_ADMIN alike (requireStaff): this only ever touches the
 * caller's row — the id comes from the session, never from the form — so
 * neither role can reach anyone else's account through it. The e-mail is not
 * editable here for the same reason it is not editable on the clients or
 * sub-admins screens: it is the login identity.
 *
 * This exists because the token-based reset flow (src/app/[locale]/(auth)/
 * reset-password) delivers its link to the SERVER CONSOLE — there is no SMTP in
 * this deployment — so in production it is not a route a shop owner can
 * actually use. A signed-in change needs no delivery channel at all.
 */
export async function changeOwnPassword(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireStaff();
    const userId = session.user.id;

    // Before any bcrypt work: verifying a password is deliberately expensive,
    // so an unthrottled guess loop would be a CPU sink as well as an attack.
    if (
      !enforceRateLimit(
        `change-password:${userId}`,
        RATE_LIMITS.changePassword.limit,
        RATE_LIMITS.changePassword.windowMs
      ).allowed
    ) {
      return failure('rateLimited');
    }

    const parsed = changePasswordSchema.safeParse({
      currentPassword: String(formData.get('currentPassword') ?? ''),
      password: String(formData.get('password') ?? ''),
      confirmPassword: String(formData.get('confirmPassword') ?? '')
    });
    if (!parsed.success) return failure('validation', fieldErrorsFromZod(parsed.error));

    const user = await prisma.user.findUnique({
      where: {id: userId},
      select: {passwordHash: true, archivedAt: true}
    });
    // An archived account cannot sign in (authorize() rejects it), so it must
    // not be able to rotate its own credential either — the session that got
    // here predates the archive.
    if (!user || user.archivedAt !== null) return failure('forbidden');

    if (!(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
      // Reported as a FIELD error on the box it belongs to, not a banner: the
      // form is otherwise valid and only that one entry is wrong.
      return failure('validation', {currentPassword: 'wrongPassword'});
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      // tokenVersion bumps with the hash, in one transaction — the same
      // revocation rider resetPassword carries. Every live JWT for this user
      // stops matching the DB and dies on its next protected navigation, so a
      // stolen session cannot outlive the password it was obtained under.
      // That includes the caller's own session, which is why the UI signs them
      // out immediately afterwards.
      await tx.user.update({
        where: {id: userId},
        data: {passwordHash, tokenVersion: {increment: 1}}
      });
      // OWASP rider, also from resetPassword: any outstanding reset link is
      // burned by a successful change, so a token minted beforehand cannot be
      // replayed afterwards to set the password back.
      await tx.passwordResetToken.updateMany({
        where: {userId, usedAt: null},
        data: {usedAt: now}
      });
    });
    return success(undefined);
  } catch (error) {
    if (error instanceof AuthzError) return failure('forbidden');
    throw error;
  }
}

/**
 * Clears the cookie after a successful change and sends the user to sign in
 * again. Deliberately does NOT call requireStaff: by the time this runs the
 * caller's own token has been revoked by the bump above, so a staff check here
 * would fail on the happy path.
 *
 * Locale-prefixed target (logout-button idiom): a bare '/login' leans on the
 * proxy to redirect, and that middleware hop does not resolve during the
 * client-side navigation a server action performs.
 */
export async function endSessionAfterPasswordChange(): Promise<void> {
  await signOut({redirectTo: `/${routing.defaultLocale}/login`});
}
