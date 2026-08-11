'use server';

import {revalidatePath} from 'next/cache';
import {failure, fieldErrorsFromZod, success, type ActionResult} from '@/lib/action-result';
import {AuthzError} from '@/lib/authz';
import {requireAdmin} from '@/server/authz';
import {prisma} from '@/lib/db';
import {categorySchema} from '@/lib/schemas/catalog';
import {ensureUniqueSlug, slugify} from '@/lib/slugify';

const PATH = '/[locale]/admin/categories';

function formToInput(formData: FormData) {
  return {
    nameFr: String(formData.get('nameFr') ?? ''),
    nameAr: String(formData.get('nameAr') ?? ''),
    parentId: String(formData.get('parentId') ?? '')
  };
}

async function validateParent(parentId: string | null, selfId?: string): Promise<string | null> {
  if (!parentId) return null;
  if (selfId && parentId === selfId) return 'invalidParent';
  const parent = await prisma.category.findUnique({where: {id: parentId}});
  if (!parent || parent.archivedAt || parent.parentId !== null) return 'invalidParent';
  if (selfId) {
    const childCount = await prisma.category.count({where: {parentId: selfId}});
    if (childCount > 0) return 'hasChildren';
  }
  return null;
}

export async function createCategory(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const parsed = categorySchema.safeParse(formToInput(formData));
    if (!parsed.success) return failure('validation', fieldErrorsFromZod(parsed.error));
    const parentError = await validateParent(parsed.data.parentId);
    if (parentError) return failure(parentError);

    const slug = await ensureUniqueSlug(
      slugify(parsed.data.nameFr) || 'categorie',
      async (s) => (await prisma.category.count({where: {slug: s}})) > 0
    );
    await prisma.category.create({
      data: {nameFr: parsed.data.nameFr, nameAr: parsed.data.nameAr, parentId: parsed.data.parentId, slug}
    });
    revalidatePath(PATH, 'page');
    return success(undefined);
  } catch (error) {
    if (error instanceof AuthzError) return failure('forbidden');
    throw error;
  }
}

export async function updateCategory(id: string, formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const parsed = categorySchema.safeParse(formToInput(formData));
    if (!parsed.success) return failure('validation', fieldErrorsFromZod(parsed.error));
    const existing = await prisma.category.findUnique({where: {id}});
    if (!existing) return failure('notFound');
    const parentError = await validateParent(parsed.data.parentId, id);
    if (parentError) return failure(parentError);

    await prisma.category.update({
      where: {id},
      data: {nameFr: parsed.data.nameFr, nameAr: parsed.data.nameAr, parentId: parsed.data.parentId}
    });
    revalidatePath(PATH, 'page');
    return success(undefined);
  } catch (error) {
    if (error instanceof AuthzError) return failure('forbidden');
    throw error;
  }
}

export async function archiveCategory(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const now = new Date();
    await prisma.$transaction([
      prisma.category.update({where: {id}, data: {archivedAt: now}}),
      prisma.category.updateMany({where: {parentId: id}, data: {archivedAt: now}})
    ]);
    revalidatePath(PATH, 'page');
    return success(undefined);
  } catch (error) {
    if (error instanceof AuthzError) return failure('forbidden');
    throw error;
  }
}

export async function restoreCategory(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    await prisma.$transaction([
      prisma.category.update({where: {id}, data: {archivedAt: null}}),
      prisma.category.updateMany({where: {parentId: id}, data: {archivedAt: null}})
    ]);
    revalidatePath(PATH, 'page');
    return success(undefined);
  } catch (error) {
    if (error instanceof AuthzError) return failure('forbidden');
    throw error;
  }
}
