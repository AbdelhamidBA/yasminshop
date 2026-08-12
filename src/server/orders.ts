import 'server-only';
import type {OrderStatus, Prisma} from '@prisma/client';
import {prisma} from '@/lib/db';

// Admin orders data access. Search (q) matches the sequential order number
// exactly when the query is numeric, and customerName / customerPhone
// contains-insensitive always. Newest first with id tiebreak, paginated with
// a $transaction'd count (storefront listing idiom).

const CLIENT_SELECT = {select: {id: true, name: true, email: true}} as const;

// Same hard cap as the storefront listing: keeps skip = (page-1)*pageSize from
// producing absurd Postgres offsets for URL-sourced page values.
const MAX_PAGE = 10_000;

// Order.number is an Int4 autoincrement — numeric queries beyond Int4 range
// can never match and would 500 inside Prisma if passed through.
const MAX_INT4 = 2_147_483_647;

export type ListOrdersParams = {
  status?: OrderStatus;
  q?: string;
  includeArchived: boolean;
  page: number;
  pageSize: number;
};

export async function listOrders(params: ListOrdersParams) {
  const page =
    Number.isSafeInteger(params.page) && params.page >= 1 && params.page <= MAX_PAGE
      ? params.page
      : 1;
  const pageSize =
    Number.isInteger(params.pageSize) && params.pageSize >= 1 && params.pageSize <= 100
      ? params.pageSize
      : 20;

  const filters: Prisma.OrderWhereInput[] = [];
  if (!params.includeArchived) filters.push({archivedAt: null});
  if (params.status) filters.push({status: params.status});

  // Scalar guard on the URL-sourced q before any Prisma filter.
  const q = typeof params.q === 'string' ? params.q.trim() : '';
  if (q.length > 0 && q.length <= 200) {
    const or: Prisma.OrderWhereInput[] = [
      {customerName: {contains: q, mode: 'insensitive'}},
      {customerPhone: {contains: q, mode: 'insensitive'}}
    ];
    if (/^\d+$/.test(q)) {
      const number = Number.parseInt(q, 10);
      if (Number.isSafeInteger(number) && number <= MAX_INT4) or.push({number});
    }
    filters.push({OR: or});
  }

  const where: Prisma.OrderWhereInput = filters.length > 0 ? {AND: filters} : {};
  const [orders, total] = await prisma.$transaction([
    prisma.order.findMany({
      where,
      orderBy: [{createdAt: 'desc'}, {id: 'asc'}],
      include: {
        _count: {select: {items: true}},
        client: CLIENT_SELECT
      },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.order.count({where})
  ]);
  return {orders, total};
}

export type OrderRow = Awaited<ReturnType<typeof listOrders>>['orders'][number];

// Order ids are cuids; same charset allowlist as the checkout/search scalar
// guards — rejects NUL bytes / lone surrogates before any Prisma filter.
const ORDER_ID_PATTERN = /^[a-z0-9-]{1,40}$/i;

export async function getOrder(id: string) {
  if (typeof id !== 'string' || !ORDER_ID_PATTERN.test(id)) return null;
  return prisma.order.findUnique({
    where: {id},
    include: {
      items: {orderBy: {id: 'asc'}},
      client: CLIENT_SELECT
    }
  });
}

export type OrderDetail = NonNullable<Awaited<ReturnType<typeof getOrder>>>;
