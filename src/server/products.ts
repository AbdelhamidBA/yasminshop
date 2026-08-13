import 'server-only';
import type {Prisma} from '@prisma/client';
import {prisma} from '@/lib/db';
import {lowStockRange, type StockFilter} from '@/lib/inventory';
import {pagingArgs} from './paging';

// Admin products data access. Search (q) matches the reference and the names
// contains-insensitive. Newest first WITH an id tiebreak: without it two rows
// sharing a createdAt could swap places between the page-1 and page-2 queries
// and be shown twice — or not at all. Paginated with a $transaction'd count
// over the SAME where clause, so the total can never disagree with the rows
// (orders/clients listing idiom).

const CATEGORY_SELECT = {select: {id: true, nameFr: true, nameAr: true}} as const;

// "Active" for the catalogue is exactly listProducts' default visibility rule:
// archivedAt: null. ARCHIVED is its exact complement, so the two scopes
// partition the product table and no row can be counted twice.
const ACTIVE: Prisma.ProductWhereInput = {archivedAt: null};
const ARCHIVED: Prisma.ProductWhereInput = {archivedAt: {not: null}};

/**
 * Which slice of the catalogue a view shows — one filter tab, in data terms.
 * The four are mutually exclusive: `archivedOnly` wins outright (an archived
 * product is out of the catalogue, so grading its stock is meaningless), and
 * the two stock bands live inside the active scope.
 */
export type ProductScope = {
  /** The Archivés tab shows archived rows ONLY, never active ones alongside. */
  archivedOnly: boolean;
  /** 'out' → quantity = 0; 'low' → the owner's low band. Ignored when archived. */
  stock?: StockFilter;
  /** Owner-configured threshold — the ONE definition of "low" (lib/inventory). */
  lastChanceThreshold: number;
};

export type ListProductsParams = ProductScope & {
  search?: string;
  page: number;
  pageSize: number;
};

/** Scalar guard on the URL-sourced search before any Prisma filter. */
function searchWhere(raw: string | undefined): Prisma.ProductWhereInput | undefined {
  const search = typeof raw === 'string' ? raw.trim() : '';
  if (search.length === 0 || search.length > 200) return undefined;
  return {
    OR: [
      {reference: {contains: search, mode: 'insensitive'}},
      {nameFr: {contains: search, mode: 'insensitive'}},
      {nameAr: {contains: search, mode: 'insensitive'}}
    ]
  };
}

function scopeWhere({archivedOnly, stock, lastChanceThreshold}: ProductScope) {
  if (archivedOnly) return ARCHIVED;
  if (stock === 'out') return {...ACTIVE, quantity: 0};
  if (stock === 'low') return {...ACTIVE, quantity: lowStockRange(lastChanceThreshold)};
  return ACTIVE;
}

/**
 * THE where clause for a products view. listProducts and getProductStats both
 * go through it, which is what makes a tab's count and its rows the same
 * question asked twice — they cannot drift.
 */
function productsWhere(params: ProductScope & {search?: string}): Prisma.ProductWhereInput {
  const filters: Prisma.ProductWhereInput[] = [scopeWhere(params)];
  const search = searchWhere(params.search);
  if (search) filters.push(search);
  return {AND: filters};
}

export async function listProducts(params: ListProductsParams) {
  const where = productsWhere(params);
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
  /** Archived products — the ?archived=1 view. */
  archived: number;
};

/**
 * The four filter-tab counters for the admin products list. Four counts in ONE
 * round trip (`$transaction` gives them a single read-consistent snapshot, so
 * two tabs can never show figures from different moments).
 *
 * Every counter is the row count of the view its tab links to — SAME
 * `productsWhere`, including the active search, because the tab links carry `q`
 * forward. A tab therefore always predicts exactly what clicking it shows.
 * `outOfStock` and `lowStock` are disjoint and both live inside `total`;
 * `archived` is outside it.
 */
export async function getProductStats({
  lastChanceThreshold,
  search
}: {
  lastChanceThreshold: number;
  search?: string;
}): Promise<ProductStats> {
  const at = (scope: Omit<ProductScope, 'lastChanceThreshold'>) =>
    productsWhere({...scope, lastChanceThreshold, search});
  const [total, outOfStock, lowStock, archived] = await prisma.$transaction([
    prisma.product.count({where: at({archivedOnly: false})}),
    prisma.product.count({where: at({archivedOnly: false, stock: 'out'})}),
    prisma.product.count({where: at({archivedOnly: false, stock: 'low'})}),
    prisma.product.count({where: at({archivedOnly: true})})
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
