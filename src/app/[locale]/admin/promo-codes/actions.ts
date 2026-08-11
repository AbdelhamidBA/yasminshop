'use server';

import {Prisma} from '@prisma/client';
import {revalidatePath} from 'next/cache';
import {failure, fieldErrorsFromZod, success, type ActionResult} from '@/lib/action-result';
import {AuthzError} from '@/lib/authz';
import {requireAdmin} from '@/server/authz';
import {prisma} from '@/lib/db';
import {promoCodeSchema} from '@/lib/schemas/catalog';

const PATH = '/[locale]/admin/promo-codes';

function formToInput(formData: FormData): {invalidDate: boolean; input: unknown} {
  const rawDate = String(formData.get('expiresAt') ?? '').trim();
  let expiresAt: Date | null = null;
  let invalidDate = false;
  if (rawDate) {
    const parsed = new Date(`${rawDate}T23:59:59`);
    if (Number.isNaN(parsed.getTime())) invalidDate = true;
    else expiresAt = parsed;
  }
  return {
    invalidDate,
    input: {
      code: String(formData.get('code') ?? ''),
      percentOff: Number.parseInt(String(formData.get('percentOff') ?? ''), 10) || 0,
      active: formData.get('active') === 'on',
      expiresAt
    }
  };
}

export async function createPromoCode(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const {invalidDate, input} = formToInput(formData);
    if (invalidDate) return failure('validation', {expiresAt: 'invalidDate'});
    const parsed = promoCodeSchema.safeParse(input);
    if (!parsed.success) return failure('validation', fieldErrorsFromZod(parsed.error));

    await prisma.promoCode.create({data: parsed.data});
    revalidatePath(PATH, 'page');
    return success(undefined);
  } catch (error) {
    if (error instanceof AuthzError) return failure('forbidden');
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return failure('validation', {code: 'codeTaken'});
    }
    throw error;
  }
}

export async function updatePromoCode(id: string, formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const existing = await prisma.promoCode.findUnique({where: {id}});
    if (!existing) return failure('notFound');
    const {invalidDate, input} = formToInput(formData);
    if (invalidDate) return failure('validation', {expiresAt: 'invalidDate'});
    const parsed = promoCodeSchema.safeParse(input);
    if (!parsed.success) return failure('validation', fieldErrorsFromZod(parsed.error));

    await prisma.promoCode.update({where: {id}, data: parsed.data});
    revalidatePath(PATH, 'page');
    return success(undefined);
  } catch (error) {
    if (error instanceof AuthzError) return failure('forbidden');
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return failure('validation', {code: 'codeTaken'});
    }
    throw error;
  }
}

export async function togglePromoCode(id: string, active: boolean): Promise<ActionResult> {
  try {
    await requireAdmin();
    const updated = await prisma.promoCode.updateMany({where: {id}, data: {active}});
    if (updated.count === 0) return failure('notFound');
    revalidatePath(PATH, 'page');
    return success(undefined);
  } catch (error) {
    if (error instanceof AuthzError) return failure('forbidden');
    throw error;
  }
}

export async function archivePromoCode(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    await prisma.promoCode.update({where: {id}, data: {archivedAt: new Date()}});
    revalidatePath(PATH, 'page');
    return success(undefined);
  } catch (error) {
    if (error instanceof AuthzError) return failure('forbidden');
    throw error;
  }
}

export async function restorePromoCode(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    await prisma.promoCode.update({where: {id}, data: {archivedAt: null}});
    revalidatePath(PATH, 'page');
    return success(undefined);
  } catch (error) {
    if (error instanceof AuthzError) return failure('forbidden');
    throw error;
  }
}
