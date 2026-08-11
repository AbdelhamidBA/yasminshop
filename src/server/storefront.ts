import 'server-only';
import type {Prisma} from '@prisma/client';
import {prisma} from '@/lib/db';

// Binding storefront visibility filter (spec §6c): the product itself is not
// archived, its category is not archived, and — when a subcategory is set —
// that subcategory is not archived either. EVERY exported product query in
// this module applies it. Combine it with other filters via `AND: [...]`
// (never spread next to another `OR`, which would clobber the subcategory arm).
export const VISIBLE = {
  archivedAt: null,
  category: {archivedAt: null},
  OR: [{subCategoryId: null}, {subCategory: {archivedAt: null}}]
} satisfies Prisma.ProductWhereInput;

// Card shape for grids/sections: one image only, ordered by
// [sortOrder asc, id asc] — the stable tiebreaker used across the storefront.
const PRODUCT_CARD_SELECT = {
  id: true,
  slug: true,
  nameFr: true,
  nameAr: true,
  priceMillimes: true,
  discountPct: true,
  quantity: true,
  images: {
    select: {id: true, url: true},
    orderBy: [{sortOrder: 'asc'}, {id: 'asc'}],
    take: 1
  }
} satisfies Prisma.ProductSelect;

const HOME_SECTION_SIZE = 8;

export async function getHomeSections(lastChanceThreshold: number) {
  const threshold =
    Number.isInteger(lastChanceThreshold) && lastChanceThreshold > 0 ? lastChanceThreshold : 0;
  const [newest, featured, lastChance, mostSearched] = await Promise.all([
    prisma.product.findMany({
      where: VISIBLE,
      orderBy: [{createdAt: 'desc'}, {id: 'asc'}],
      select: PRODUCT_CARD_SELECT,
      take: HOME_SECTION_SIZE
    }),
    prisma.product.findMany({
      where: {AND: [VISIBLE, {featured: true}]},
      orderBy: [{createdAt: 'desc'}, {id: 'asc'}],
      select: PRODUCT_CARD_SELECT,
      take: HOME_SECTION_SIZE
    }),
    prisma.product.findMany({
      // In stock but at/below the threshold; lowest stock first (most urgent).
      where: {AND: [VISIBLE, {quantity: {gt: 0, lte: threshold}}]},
      orderBy: [{quantity: 'asc'}, {id: 'asc'}],
      select: PRODUCT_CARD_SELECT,
      take: HOME_SECTION_SIZE
    }),
    prisma.product.findMany({
      where: {AND: [VISIBLE, {searchHits: {gt: 0}}]},
      orderBy: [{searchHits: 'desc'}, {id: 'asc'}],
      select: PRODUCT_CARD_SELECT,
      take: HOME_SECTION_SIZE
    })
  ]);
  return {newest, featured, lastChance, mostSearched};
}

export type ProductCardData = Awaited<
  ReturnType<typeof getHomeSections>
>['newest'][number];

export type StorefrontSort = 'new' | 'priceAsc' | 'priceDesc';

export type StorefrontListParams = {
  q?: string;
  categorySlug?: string;
  subCategorySlug?: string;
  minPriceMillimes?: number;
  maxPriceMillimes?: number;
  inStock?: boolean;
  sort?: StorefrontSort;
  page: number;
  pageSize: number;
};

function cleanSlug(value: string | undefined): string | null {
  // Scalar guard for URL-sourced slugs before any Prisma filter.
  if (typeof value !== 'string') return null;
  const slug = value.trim();
  return slug.length > 0 && slug.length <= 200 ? slug : null;
}

function cleanMillimes(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

export async function listStorefrontProducts(
  params: StorefrontListParams
): Promise<{products: ProductCardData[]; total: number}> {
  // page must be an int ≥ 1 (URL-sourced); pageSize is fixed by the caller but
  // still sanity-clamped to an int in 1..100.
  const page = Number.isInteger(params.page) && params.page >= 1 ? params.page : 1;
  const pageSize =
    Number.isInteger(params.pageSize) && params.pageSize >= 1 && params.pageSize <= 100
      ? params.pageSize
      : 12;

  // Every filter is ANDed alongside VISIBLE so its OR arm is never clobbered.
  const filters: Prisma.ProductWhereInput[] = [VISIBLE];

  const q = typeof params.q === 'string' ? params.q.trim() : '';
  if (q.length > 0 && q.length <= 200) {
    filters.push({
      OR: [
        {nameFr: {contains: q, mode: 'insensitive'}},
        {nameAr: {contains: q, mode: 'insensitive'}},
        {reference: {contains: q, mode: 'insensitive'}}
      ]
    });
  }

  // Category slug resolution: one query per provided slug. A root (category)
  // slug matches products attached to it directly OR through any of its
  // non-archived children; a subcategory slug matches subCategoryId only.
  const categorySlug = cleanSlug(params.categorySlug);
  if (categorySlug !== null) {
    const category = await prisma.category.findFirst({
      where: {slug: categorySlug, archivedAt: null},
      select: {id: true, children: {where: {archivedAt: null}, select: {id: true}}}
    });
    if (!category) return {products: [], total: 0};
    const ids = [category.id, ...category.children.map((c) => c.id)];
    filters.push({OR: [{categoryId: {in: ids}}, {subCategoryId: {in: ids}}]});
  }

  const subCategorySlug = cleanSlug(params.subCategorySlug);
  if (subCategorySlug !== null) {
    const subCategory = await prisma.category.findFirst({
      where: {slug: subCategorySlug, archivedAt: null},
      select: {id: true}
    });
    if (!subCategory) return {products: [], total: 0};
    filters.push({subCategoryId: subCategory.id});
  }

  // Price range filters on the RAW priceMillimes — discounts (per-product or
  // mass) are NOT applied to range filtering. Good enough for catalog
  // filtering, per the plan; documented here on purpose.
  const min = cleanMillimes(params.minPriceMillimes);
  const max = cleanMillimes(params.maxPriceMillimes);
  if (min !== null || max !== null) {
    filters.push({
      priceMillimes: {
        ...(min !== null ? {gte: min} : {}),
        ...(max !== null ? {lte: max} : {})
      }
    });
  }

  if (params.inStock === true) filters.push({quantity: {gt: 0}});

  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    params.sort === 'priceAsc'
      ? [{priceMillimes: 'asc'}, {id: 'asc'}]
      : params.sort === 'priceDesc'
        ? [{priceMillimes: 'desc'}, {id: 'asc'}]
        : [{createdAt: 'desc'}, {id: 'asc'}];

  const where: Prisma.ProductWhereInput = {AND: filters};
  const [products, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      orderBy,
      select: PRODUCT_CARD_SELECT,
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.product.count({where})
  ]);
  return {products, total};
}

const CATEGORY_NAME_SELECT = {
  select: {id: true, nameFr: true, nameAr: true, slug: true}
} as const;

export async function getStorefrontProduct(slug: string) {
  const clean = cleanSlug(slug);
  if (clean === null) return null;
  return prisma.product.findFirst({
    where: {AND: [VISIBLE, {slug: clean}]},
    include: {
      images: {orderBy: [{sortOrder: 'asc'}, {id: 'asc'}]},
      category: CATEGORY_NAME_SELECT,
      subCategory: CATEGORY_NAME_SELECT
    }
  });
}

export type StorefrontProduct = NonNullable<
  Awaited<ReturnType<typeof getStorefrontProduct>>
>;

export async function getRelatedProducts(
  productId: string,
  categoryId: string
): Promise<ProductCardData[]> {
  if (typeof productId !== 'string' || productId.length === 0) return [];
  if (typeof categoryId !== 'string' || categoryId.length === 0) return [];
  return prisma.product.findMany({
    where: {AND: [VISIBLE, {categoryId, id: {not: productId}}]},
    orderBy: [{createdAt: 'desc'}, {id: 'asc'}],
    select: PRODUCT_CARD_SELECT,
    take: 4
  });
}

// Non-archived roots with their non-archived children, for the filter sidebar
// and storefront nav. (Category visibility here IS the archived filter — the
// product-shaped VISIBLE constant does not apply to Category queries.)
export async function listVisibleCategoryTree() {
  return prisma.category.findMany({
    where: {parentId: null, archivedAt: null},
    orderBy: {nameFr: 'asc'},
    select: {
      id: true,
      nameFr: true,
      nameAr: true,
      slug: true,
      children: {
        where: {archivedAt: null},
        orderBy: {nameFr: 'asc'},
        select: {id: true, nameFr: true, nameAr: true, slug: true}
      }
    }
  });
}

export type StorefrontCategoryNode = Awaited<
  ReturnType<typeof listVisibleCategoryTree>
>[number];
