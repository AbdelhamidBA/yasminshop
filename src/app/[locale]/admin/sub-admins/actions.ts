'use server';

import {revalidatePath} from 'next/cache';
import {Prisma} from '@prisma/client';
import {z} from 'zod';
import {failure, fieldErrorsFromZod, success, type ActionResult} from '@/lib/action-result';
import {AuthzError} from '@/lib/authz';
import {sanitizeIds} from '@/lib/bulk';
import {prisma} from '@/lib/db';
import {hashPassword} from '@/lib/password';
import {requireAdmin} from '@/server/authz';

const PATH = '/[locale]/admin/sub-admins';

// User ids are cuids; same charset allowlist as the clients actions (Phase 2
// fix-wave idiom) — applied to EVERY client-supplied id.
const ID_PATTERN = /^[a-z0-9-]{1,40}$/i;

// Create input — name/email/password only. role is NEVER read from the form:
// createSubAdmin hardcodes SUB_ADMIN below. Mirrors registerSchema's message
// KEYS (spec §6c idiom), translated via subAdmins.errors.*. The password is NOT
// trimmed (auth passwordField idiom — whitespace is a legal password char and
// trimming would diverge from what authorize()/bcrypt later compare).
const subAdminCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, {message: 'required'})
    .min(2, {message: 'tooShort'})
    .max(120, {message: 'tooLong'}),
  email: z
    .string()
    .trim()
    .min(1, {message: 'required'})
    .max(254, {message: 'tooLong'})
    .email({message: 'invalidEmail'}),
  password: z
    .string()
    .min(1, {message: 'required'})
    .min(8, {message: 'passwordTooShort'})
    .max(200, {message: 'tooLong'})
});

// Update input — name/phone ONLY. email (login identity), password (reset
// flow), and role are deliberately absent, exactly like updateClient. phone is
// OPTIONAL: empty clears it (stored null), non-empty must satisfy the checkout
// phone constraint.
const subAdminUpdateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, {message: 'required'})
    .min(2, {message: 'tooShort'})
    .max(120, {message: 'tooLong'}),
  phone: z
    .string()
    .trim()
    .refine((v) => v === '' || /^[0-9+ ]{8,15}$/.test(v), {message: 'invalidPhone'})
});

// All sub-admin mutations are ADMIN-only (page + every action; a sub-admin gets
// notFound at the page and forbidden here) and pin role SUB_ADMIN in every
// WHERE — an ADMIN / CLIENT id behaves exactly like an unknown id, so this
// surface can never touch the owner ADMIN or a client. The role pin forces
// updateMany (update needs a unique WHERE), so the P2025→notFound mapping
// becomes a count === 0 check — same outcome, no throw involved.

export async function createSubAdmin(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const parsed = subAdminCreateSchema.safeParse({
      name: String(formData.get('name') ?? ''),
      email: String(formData.get('email') ?? ''),
      password: String(formData.get('password') ?? '')
    });
    if (!parsed.success) return failure('validation', fieldErrorsFromZod(parsed.error));

    try {
      // role SUB_ADMIN is HARDCODED here — never sourced from the form.
      await prisma.user.create({
        data: {
          name: parsed.data.name,
          email: parsed.data.email,
          passwordHash: await hashPassword(parsed.data.password),
          role: 'SUB_ADMIN'
        }
      });
    } catch (error) {
      // Unique email taken → field-level KEY (registerClient idiom): P2002 is
      // the schema's own race-free uniqueness check.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return failure('validation', {email: 'emailTaken'});
      }
      throw error;
    }
    revalidatePath(PATH, 'page');
    return success(undefined);
  } catch (error) {
    if (error instanceof AuthzError) return failure('forbidden');
    throw error;
  }
}

export async function updateSubAdmin(id: string, formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    if (typeof id !== 'string' || !ID_PATTERN.test(id)) return failure('notFound');

    // Pre-load for the precise failure split (notFound vs subAdminArchived) —
    // archived sub-admins are view-only (clients archived-view-only ruling),
    // restore first to edit.
    const existing = await prisma.user.findFirst({
      where: {id, role: 'SUB_ADMIN'},
      select: {archivedAt: true}
    });
    if (!existing) return failure('notFound');
    if (existing.archivedAt !== null) return failure('subAdminArchived');

    const parsed = subAdminUpdateSchema.safeParse({
      name: String(formData.get('name') ?? ''),
      phone: String(formData.get('phone') ?? '')
    });
    if (!parsed.success) return failure('validation', fieldErrorsFromZod(parsed.error));

    // The WHERE re-states role + archived (updateClient TOCTOU-pin idiom): a
    // concurrent archive between the read above and this write makes count 0
    // instead of editing an archived row.
    // NO tokenVersion bump: this edits name/phone only — neither role, email,
    // nor password changes here, so live sessions stay valid (no revocation
    // event). Credential/role changes route through reset / archive, which bump.
    const updated = await prisma.user.updateMany({
      where: {id, role: 'SUB_ADMIN', archivedAt: null},
      data: {
        name: parsed.data.name,
        phone: parsed.data.phone || null
      }
    });
    if (updated.count === 0) return failure('subAdminArchived');
    revalidatePath(PATH, 'page');
    return success(undefined);
  } catch (error) {
    if (error instanceof AuthzError) return failure('forbidden');
    throw error;
  }
}

export async function archiveSubAdmin(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    if (typeof id !== 'string' || !ID_PATTERN.test(id)) return failure('notFound');
    // Archiving also blocks login: authorize() rejects users with a non-null
    // archivedAt (enforced in src/auth.ts since Phase 1). The tokenVersion bump
    // additionally KILLS any already-live staff session — archiving a sub-admin
    // revokes their access on the next protected page/action, not at expiry.
    const updated = await prisma.user.updateMany({
      where: {id, role: 'SUB_ADMIN'},
      data: {archivedAt: new Date(), tokenVersion: {increment: 1}}
    });
    if (updated.count === 0) return failure('notFound');
    revalidatePath(PATH, 'page');
    return success(undefined);
  } catch (error) {
    if (error instanceof AuthzError) return failure('forbidden');
    throw error;
  }
}

export async function restoreSubAdmin(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    if (typeof id !== 'string' || !ID_PATTERN.test(id)) return failure('notFound');
    // Restore also bumps tokenVersion (belt-and-braces; an archived sub-admin
    // has no live session), keeping every archive/restore a clean boundary.
    const updated = await prisma.user.updateMany({
      where: {id, role: 'SUB_ADMIN'},
      data: {archivedAt: null, tokenVersion: {increment: 1}}
    });
    if (updated.count === 0) return failure('notFound');
    revalidatePath(PATH, 'page');
    return success(undefined);
  } catch (error) {
    if (error instanceof AuthzError) return failure('forbidden');
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Mass actions
// ---------------------------------------------------------------------------

/**
 * Archive/restore a reviewed selection of sub-admins. ADMIN only (this whole
 * surface already is), ids scalar-guarded and capped, and one updateMany so the
 * batch cannot half-apply. NO delete: a sub-admin is a staff record.
 */
export async function archiveSubAdmins(ids: unknown): Promise<ActionResult<number>> {
  return setSubAdminsArchived(ids, new Date());
}

export async function restoreSubAdmins(ids: unknown): Promise<ActionResult<number>> {
  return setSubAdminsArchived(ids, null);
}

/**
 * Carries EVERY side effect of the single-row actions:
 *  - `role: 'SUB_ADMIN'` stays pinned in the WHERE, so an ADMIN or CLIENT id
 *    smuggled into the selection behaves exactly like an unknown id — this
 *    surface can never archive the owner ADMIN or a client.
 *  - `tokenVersion: {increment: 1}` rides in the SAME updateMany, so a bulk
 *    archive KILLS the live staff sessions of everyone in the batch on their
 *    next protected page/action, not at token expiry. Restore bumps too
 *    (belt-and-braces), keeping every archive/restore a clean boundary.
 */
async function setSubAdminsArchived(
  ids: unknown,
  archivedAt: Date | null
): Promise<ActionResult<number>> {
  const clean = sanitizeIds(ids);
  if (!clean) return failure('invalidSelection');
  try {
    await requireAdmin();
    const {count} = await prisma.user.updateMany({
      where: {id: {in: clean}, role: 'SUB_ADMIN'},
      data: {archivedAt, tokenVersion: {increment: 1}}
    });
    revalidatePath(PATH, 'page');
    return success(count);
  } catch (error) {
    if (error instanceof AuthzError) return failure('forbidden');
    throw error;
  }
}
