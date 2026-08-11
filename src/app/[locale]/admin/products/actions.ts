'use server';

import {Prisma} from '@prisma/client';
import {revalidatePath} from 'next/cache';
import {failure, fieldErrorsFromZod, success, type ActionResult} from '@/lib/action-result';
import {AuthzError} from '@/lib/authz';
import {requireAdmin, requireStaff} from '@/server/authz';
import {prisma} from '@/lib/db';
import {parseDinarsToMillimes} from '@/lib/money';
import {productSchema, quantitySchema} from '@/lib/schemas/catalog';

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
    const created = await prisma.product.create({
      data: {...fields, images: {create: images}}
    });
    revalidatePath(PATH, 'page');
    return success({id: created.id});
  } catch (error) {
    if (error instanceof AuthzError) return failure('forbidden');
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
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
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return failure('validation', {reference: 'referenceTaken'});
    }
    throw error;
  }
}

export async function updateProductQuantity(id: string, quantity: number): Promise<ActionResult> {
  try {
    await requireStaff();
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
