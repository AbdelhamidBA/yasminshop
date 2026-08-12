'use server';

import {revalidatePath} from 'next/cache';
import {z} from 'zod';
import {failure, fieldErrorsFromZod, success, type ActionResult} from '@/lib/action-result';
import {AuthzError} from '@/lib/authz';
import {prisma} from '@/lib/db';
import {requireAdmin} from '@/server/authz';

const PATH = '/[locale]/admin/clients';

// User ids are cuids; same charset allowlist as the orders actions (Phase 2
// fix-wave idiom) — applied to EVERY client-supplied id.
const ID_PATTERN = /^[a-z0-9-]{1,40}$/i;

// Editable profile fields ONLY — email and password are deliberately absent
// (email is the login identity, password changes go through the reset flow).
// name mirrors the checkoutSchema rule; phone/address/city are OPTIONAL
// (registration collects none of them): empty clears the field (stored as
// null), non-empty must satisfy the matching checkout constraint. Every
// message is a KEY (spec §6c idiom), translated via adminClients.errors.*.
const clientProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, {message: 'required'})
    .min(2, {message: 'tooShort'})
    .max(120, {message: 'tooLong'}),
  phone: z
    .string()
    .trim()
    .refine((v) => v === '' || /^[0-9+ ]{8,15}$/.test(v), {message: 'invalidPhone'}),
  address: z
    .string()
    .trim()
    .max(300, {message: 'tooLong'})
    .refine((v) => v === '' || v.length >= 5, {message: 'tooShort'}),
  city: z
    .string()
    .trim()
    .max(120, {message: 'tooLong'})
    .refine((v) => v === '' || v.length >= 2, {message: 'tooShort'})
});

// All client mutations are ADMIN-only (plan binding: pages requirePageStaff,
// mutations requireAdmin) and pin role CLIENT in every WHERE — a staff
// account id behaves exactly like an unknown id (notFound), so this surface
// can never touch ADMIN / SUB_ADMIN rows. The role pin forces updateMany
// (update needs a unique WHERE), so the orders' P2025→notFound mapping
// becomes a count === 0 check here — same outcome, no throw involved.

export async function updateClient(id: string, formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    if (typeof id !== 'string' || !ID_PATTERN.test(id)) return failure('notFound');

    // Pre-load for the precise failure split (notFound vs clientArchived) —
    // archived clients are view-only (Task 4 ruling: archived means fully
    // view-only), restore first to edit.
    const existing = await prisma.user.findFirst({
      where: {id, role: 'CLIENT'},
      select: {archivedAt: true}
    });
    if (!existing) return failure('notFound');
    if (existing.archivedAt !== null) return failure('clientArchived');

    const parsed = clientProfileSchema.safeParse({
      name: String(formData.get('name') ?? ''),
      phone: String(formData.get('phone') ?? ''),
      address: String(formData.get('address') ?? ''),
      city: String(formData.get('city') ?? '')
    });
    if (!parsed.success) return failure('validation', fieldErrorsFromZod(parsed.error));

    // The WHERE re-states role + archived (updateOrderCustomer TOCTOU-pin
    // idiom): a concurrent archive between the read above and this write
    // makes count 0 instead of editing an archived row.
    const updated = await prisma.user.updateMany({
      where: {id, role: 'CLIENT', archivedAt: null},
      data: {
        name: parsed.data.name,
        phone: parsed.data.phone || null,
        address: parsed.data.address || null,
        city: parsed.data.city || null
      }
    });
    if (updated.count === 0) return failure('clientArchived');
    revalidatePath(PATH, 'page');
    return success(undefined);
  } catch (error) {
    if (error instanceof AuthzError) return failure('forbidden');
    throw error;
  }
}

export async function archiveClient(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    if (typeof id !== 'string' || !ID_PATTERN.test(id)) return failure('notFound');
    // Archiving also blocks login: authorize() rejects users with a non-null
    // archivedAt (enforced in src/auth.ts since Phase 1).
    const updated = await prisma.user.updateMany({
      where: {id, role: 'CLIENT'},
      data: {archivedAt: new Date()}
    });
    if (updated.count === 0) return failure('notFound');
    revalidatePath(PATH, 'page');
    return success(undefined);
  } catch (error) {
    if (error instanceof AuthzError) return failure('forbidden');
    throw error;
  }
}

export async function restoreClient(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    if (typeof id !== 'string' || !ID_PATTERN.test(id)) return failure('notFound');
    const updated = await prisma.user.updateMany({
      where: {id, role: 'CLIENT'},
      data: {archivedAt: null}
    });
    if (updated.count === 0) return failure('notFound');
    revalidatePath(PATH, 'page');
    return success(undefined);
  } catch (error) {
    if (error instanceof AuthzError) return failure('forbidden');
    throw error;
  }
}
