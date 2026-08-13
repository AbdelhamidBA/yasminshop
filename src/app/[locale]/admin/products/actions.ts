'use server';

import {Prisma} from '@prisma/client';
import {revalidatePath} from 'next/cache';
import {failure, fieldErrorsFromZod, success, type ActionResult} from '@/lib/action-result';
import {AuthzError} from '@/lib/authz';
import {requireAdmin, requireStaff} from '@/server/authz';
import {prisma} from '@/lib/db';
import {sanitizeIds} from '@/lib/bulk';
import {parseDinarsToMillimes} from '@/lib/money';
import {productSchema, quantitySchema} from '@/lib/schemas/catalog';
import {ensureUniqueSlug, slugify} from '@/lib/slugify';

const PATH = '/[locale]/admin/products';

type RawImages = Array<{url: string; sortOrder: number}>;

function parseImages(formData: FormData): RawImages | null {
  try {
    const parsed = JSON.parse(String(formData.get('images') ?? '[]'));
    return Array.isArray(parsed) ? (parsed as RawImages) : null;
  } catch {
    return null;
  }
}

function formToInput(formData: FormData) {
  const priceMillimes = parseDinarsToMillimes(String(formData.get('price') ?? ''));
  const images = parseImages(formData);
  return {
    priceInvalid: priceMillimes === null,
    imagesInvalid: images === null,
    input: {
      reference: String(formData.get('reference') ?? ''),
      nameFr: String(formData.get('nameFr') ?? ''),
      nameAr: String(formData.get('nameAr') ?? ''),
      descriptionFr: String(formData.get('descriptionFr') ?? ''),
      descriptionAr: String(formData.get('descriptionAr') ?? ''),
      priceMillimes: priceMillimes ?? 0,
      discountPct: Number.parseInt(String(formData.get('discountPct') ?? '0'), 10) || 0,
      quantity: Number.parseInt(String(formData.get('quantity') ?? '0'), 10) || 0,
      featured: formData.get('featured') === 'on',
      categoryId: String(formData.get('categoryId') ?? ''),
      subCategoryId: String(formData.get('subCategoryId') ?? ''),
      images: images ?? []
    }
  };
}

async function validateCategoryPair(
  categoryId: string,
  subCategoryId: string | null
): Promise<string | null> {
  const category = await prisma.category.findUnique({where: {id: categoryId}});
  if (!category || category.archivedAt || category.parentId !== null) return 'invalidCategory';
  if (subCategoryId) {
    const sub = await prisma.category.findUnique({where: {id: subCategoryId}});
    if (!sub || sub.archivedAt || sub.parentId !== categoryId) return 'invalidSubCategory';
  }
  return null;
}

function validateImageUrls(images: RawImages): boolean {
  return images.every((image) => image.url.startsWith('/api/uploads/'));
}

function generateProductSlug(nameFr: string): Promise<string> {
  return ensureUniqueSlug(
    slugify(nameFr) || 'produit',
    async (s) => (await prisma.product.count({where: {slug: s}})) > 0
  );
}

// P2002 can fire on Product.reference or Product.slug — discriminate by the
// violated constraint's target column.
function isUniqueViolationOn(error: unknown, column: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return false;
  }
  const target = error.meta?.target;
  return Array.isArray(target) ? target.includes(column) : String(target ?? '').includes(column);
}

export async function createProduct(formData: FormData): Promise<ActionResult<{id: string}>> {
  try {
    await requireAdmin();
    const {priceInvalid, imagesInvalid, input} = formToInput(formData);
    if (priceInvalid) return failure('validation', {price: 'invalidAmount'});
    if (imagesInvalid) return failure('validation', {images: 'imagesRequired'});
    const parsed = productSchema.safeParse(input);
    if (!parsed.success) return failure('validation', fieldErrorsFromZod(parsed.error));
    if (!validateImageUrls(parsed.data.images)) return failure('validation', {images: 'imagesRequired'});
    const categoryError = await validateCategoryPair(parsed.data.categoryId, parsed.data.subCategoryId);
    if (categoryError) return failure(categoryError);

    const {images, ...fields} = parsed.data;
    let created;
    try {
      const slug = await generateProductSlug(fields.nameFr);
      created = await prisma.product.create({
        data: {...fields, slug, images: {create: images}}
      });
    } catch (error) {
      // Concurrent create can race ensureUniqueSlug; retry once with a fresh
      // slug, then rethrow.
      if (!isUniqueViolationOn(error, 'slug')) throw error;
      const slug = await generateProductSlug(fields.nameFr);
      created = await prisma.product.create({
        data: {...fields, slug, images: {create: images}}
      });
    }
    revalidatePath(PATH, 'page');
    return success({id: created.id});
  } catch (error) {
    if (error instanceof AuthzError) return failure('forbidden');
    if (isUniqueViolationOn(error, 'reference')) {
      return failure('validation', {reference: 'referenceTaken'});
    }
    throw error;
  }
}

export async function updateProduct(id: string, formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const existing = await prisma.product.findUnique({where: {id}});
    if (!existing) return failure('notFound');
    const {priceInvalid, imagesInvalid, input} = formToInput(formData);
    if (priceInvalid) return failure('validation', {price: 'invalidAmount'});
    if (imagesInvalid) return failure('validation', {images: 'imagesRequired'});
    const parsed = productSchema.safeParse(input);
    if (!parsed.success) return failure('validation', fieldErrorsFromZod(parsed.error));
    if (!validateImageUrls(parsed.data.images)) return failure('validation', {images: 'imagesRequired'});
    const categoryError = await validateCategoryPair(parsed.data.categoryId, parsed.data.subCategoryId);
    if (categoryError) return failure(categoryError);

    const {images, ...fields} = parsed.data;
    await prisma.$transaction([
      prisma.product.update({where: {id}, data: fields}),
      prisma.productImage.deleteMany({where: {productId: id}}),
      prisma.productImage.createMany({
        data: images.map((image) => ({...image, productId: id}))
      })
    ]);
    revalidatePath(PATH, 'page');
    return success(undefined);
  } catch (error) {
    if (error instanceof AuthzError) return failure('forbidden');
    if (isUniqueViolationOn(error, 'reference')) {
      return failure('validation', {reference: 'referenceTaken'});
    }
    throw error;
  }
}

export async function updateProductQuantity(id: string, quantity: number): Promise<ActionResult> {
  try {
    await requireStaff();
    if (typeof id !== 'string' || id.length === 0) return failure('notFound');
    const parsed = quantitySchema.safeParse({quantity});
    if (!parsed.success) return failure('validation', {quantity: 'invalidQuantity'});
    const updated = await prisma.product.updateMany({
      where: {id},
      data: {quantity: parsed.data.quantity}
    });
    if (updated.count === 0) return failure('notFound');
    revalidatePath(PATH, 'page');
    return success(undefined);
  } catch (error) {
    if (error instanceof AuthzError) return failure('forbidden');
    throw error;
  }
}

export async function archiveProduct(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    await prisma.product.update({where: {id}, data: {archivedAt: new Date()}});
    revalidatePath(PATH, 'page');
    return success(undefined);
  } catch (error) {
    if (error instanceof AuthzError) return failure('forbidden');
    throw error;
  }
}

export async function restoreProduct(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    await prisma.product.update({where: {id}, data: {archivedAt: null}});
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
 * Archive/restore a reviewed selection. ADMIN only (a SUB_ADMIN may change
 * product quantity and nothing else), ids scalar-guarded and capped, and the
 * write is a single updateMany so a partial batch cannot half-apply.
 */
export async function archiveProducts(ids: unknown): Promise<ActionResult<number>> {
  return setProductsArchived(ids, new Date());
}

export async function restoreProducts(ids: unknown): Promise<ActionResult<number>> {
  return setProductsArchived(ids, null);
}

async function setProductsArchived(
  ids: unknown,
  archivedAt: Date | null
): Promise<ActionResult<number>> {
  const clean = sanitizeIds(ids);
  if (!clean) return failure('invalidSelection');
  try {
    await requireAdmin();
    const {count} = await prisma.product.updateMany({
      where: {id: {in: clean}},
      data: {archivedAt}
    });
    revalidatePath(PATH, 'page');
    return success(count);
  } catch (error) {
    if (error instanceof AuthzError) return failure('forbidden');
    throw error;
  }
}

/**
 * Permanently delete products — the one irreversible action in the admin.
 *
 * A product that has ever been ordered CANNOT be deleted: OrderItem holds a
 * required FK to Product (no onDelete rule, so Postgres restricts), and past
 * orders must keep resolving to the product they were placed against. Rather
 * than let the database throw, this checks first and refuses the whole batch
 * with `soldProducts`, telling the operator to archive those instead — archive
 * is what "remove it from the shop" actually means here.
 *
 * ProductImage rows cascade. The uploaded FILES are intentionally left on disk
 * (documented in the README's known limitations): they are content-addressed
 * uploads that no longer have a DB reference, and deleting them during a bulk
 * action risks removing a file another record still points at.
 */
export async function deleteProducts(ids: unknown): Promise<ActionResult<number>> {
  const clean = sanitizeIds(ids);
  if (!clean) return failure('invalidSelection');
  try {
    await requireAdmin();

    const sold = await prisma.orderItem.findMany({
      where: {productId: {in: clean}},
      select: {productId: true},
      distinct: ['productId']
    });
    if (sold.length > 0) return failure('soldProducts');

    // Re-checked inside the transaction: an order could land between the read
    // above and the delete, and order history must win over a bulk cleanup.
    const count = await prisma.$transaction(async (tx) => {
      const raced = await tx.orderItem.count({where: {productId: {in: clean}}});
      if (raced > 0) throw new SoldProductError();
      const result = await tx.product.deleteMany({where: {id: {in: clean}}});
      return result.count;
    });

    revalidatePath(PATH, 'page');
    return success(count);
  } catch (error) {
    if (error instanceof SoldProductError) return failure('soldProducts');
    if (error instanceof AuthzError) return failure('forbidden');
    // Belt and braces: a FK violation that slipped past both checks is still
    // "this product has been ordered", never an unhandled 500.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      return failure('soldProducts');
    }
    throw error;
  }
}

class SoldProductError extends Error {}
