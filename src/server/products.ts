import 'server-only';
import type {Prisma} from '@prisma/client';
import {prisma} from '@/lib/db';
import {lowStockRange} from '@/lib/inventory';
import {pagingArgs} from './paging';

// Admin products data access. Search (q) matches the reference and the names
// contains-insensitive. Newest first WITH an id tiebreak: without it two rows
// sharing a createdAt could swap places between the page-1 and page-2 queries
// and be shown twice — or not at all. Paginated with a $transaction'd count
// over the SAME where clause, so the total can never disagree with the rows
// (orders/clients listing idiom).

const CATEGORY_SELECT = {select: {id: true, nameFr: true, nameAr: true}} as const;

// "Active" for the catalogue is exactly listProducts' default visibility rule:
// archivedAt: null. The archived counter is its complement, so total + archived
// is the whole product table and neither figure can double-count.
const ACTIVE: Prisma.ProductWhereInput = {archivedAt: null};

export type ListProductsParams = {
  search?: string;
  includeArchived: boolean;
  page: number;
  pageSize: number;
};

export async function listProducts(params: ListProductsParams) {
  const filters: Prisma.ProductWhereInput[] = [];
  if (!params.includeArchived) filters.push(ACTIVE);

  // Scalar guard on the URL-sourced search before any Prisma filter.
  const search = typeof params.search === 'string' ? params.search.trim() : '';
  if (search.length > 0 && search.length <= 200) {
    filters.push({
      OR: [
        {reference: {contains: search, mode: 'insensitive'}},
        {nameFr: {contains: search, mode: 'insensitive'}},
        {nameAr: {contains: search, mode: 'insensitive'}}
      ]
    });
  }

  const where: Prisma.ProductWhereInput = filters.length > 0 ? {AND: filters} : {};
  const [products, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      orderBy: [{createdAt: 'desc'}, {id: 'asc'}],
      include: {
        images: {orderBy: {sortOrder: 'asc'}},
        category: CATEGORY_SELECT,
        subCategory: CATEGORY_SELECT
      },
      ...pagingArgs(params)
    }),
    prisma.product.count({where})
  ]);
  return {products, total};
}

export type ProductRow = Awaited<ReturnType<typeof listProducts>>['products'][number];

export type ProductStats = {
  /** Non-archived products — the catalogue the shop actually sells from. */
  total: number;
  /** Active products with no stock at all (quantity = 0). */
  outOfStock: number;
  /** Active products still in stock but at or below lastChanceThreshold. */
  lowStock: number;
  /** Archived products — reachable through the list's ?archived=1 filter. */
  archived: number;
};

/**
 * Catalogue counters for the admin products header. Four counts in ONE round
 * trip (`$transaction` gives them a single read-consistent snapshot, so the
 * tiles can never show a torn total).
 *
 * Scope: the whole catalogue, deliberately NOT the current search — `q` narrows
 * the table below, while these summarise what the shop owns. `outOfStock` and
 * `lowStock` are disjoint and both live inside `total`; `archived` is outside it.
 */
export async function getProductStats(lastChanceThreshold: number): Promise<ProductStats> {
  const [total, outOfStock, lowStock, archived] = await prisma.$transaction([
    prisma.product.count({where: ACTIVE}),
    prisma.product.count({where: {...ACTIVE, quantity: 0}}),
    prisma.product.count({where: {...ACTIVE, quantity: lowStockRange(lastChanceThreshold)}}),
    prisma.product.count({where: {archivedAt: {not: null}}})
  ]);
  return {total, outOfStock, lowStock, archived};
}

export async function getProduct(id: string) {
  return prisma.product.findUnique({
    where: {id},
    include: {
      images: {orderBy: {sortOrder: 'asc'}},
      category: CATEGORY_SELECT,
      subCategory: CATEGORY_SELECT
    }
  });
}

export type ProductDetail = NonNullable<Awaited<ReturnType<typeof getProduct>>>;
