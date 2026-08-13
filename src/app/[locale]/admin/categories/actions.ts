'use server';

import {revalidatePath} from 'next/cache';
import {failure, fieldErrorsFromZod, success, type ActionResult} from '@/lib/action-result';
import {AuthzError} from '@/lib/authz';
import {requireAdmin} from '@/server/authz';
import {sanitizeIds} from '@/lib/bulk';
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

// ---------------------------------------------------------------------------
// Mass actions
// ---------------------------------------------------------------------------

/**
 * Archive/restore a reviewed selection. ADMIN only, ids scalar-guarded and
 * capped, and the whole batch is one transaction so it cannot half-apply.
 */
export async function archiveCategories(ids: unknown): Promise<ActionResult<number>> {
  return setCategoriesArchived(ids, new Date());
}

export async function restoreCategories(ids: unknown): Promise<ActionResult<number>> {
  return setCategoriesArchived(ids, null);
}

/**
 * Reproduces archiveCategory/restoreCategory's CASCADE exactly, batched rather
 * than looped: the single-row action writes the row itself plus every row whose
 * parentId is that row, and the tree is only ever two deep (validateParent
 * refuses a parent that already has a parent), so one extra `parentId: {in}`
 * updateMany covers the sub-categories of EVERY selected id at once — there is
 * no grandchild level a loop would have reached and this does not. Selecting a
 * sub-category is harmless: it has no children, so the second statement simply
 * matches nothing for it. Both statements share one transaction, so a category
 * can never end up archived with its sub-categories still live.
 *
 * Archiving hides the category AND its sub-categories from the storefront; the
 * products underneath stop being reachable through it, exactly as the per-row
 * action already promised in its confirm dialog.
 *
 * The returned count is the number of DIRECTLY selected rows written (the
 * cascade is a side effect, as it is per row).
 */
async function setCategoriesArchived(
  ids: unknown,
  archivedAt: Date | null
): Promise<ActionResult<number>> {
  const clean = sanitizeIds(ids);
  if (!clean) return failure('invalidSelection');
  try {
    await requireAdmin();
    const [selected] = await prisma.$transaction([
      prisma.category.updateMany({where: {id: {in: clean}}, data: {archivedAt}}),
      prisma.category.updateMany({where: {parentId: {in: clean}}, data: {archivedAt}})
    ]);
    revalidatePath(PATH, 'page');
    return success(selected.count);
  } catch (error) {
    if (error instanceof AuthzError) return failure('forbidden');
    throw error;
  }
}
