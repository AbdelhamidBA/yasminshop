import 'server-only';
import type {OrderStatus, Prisma} from '@prisma/client';
import {prisma} from '@/lib/db';
import {ALLOWED_TRANSITIONS} from '@/lib/orders';
import {pagingArgs} from './paging';

// Admin orders data access. Search (q) matches the sequential order number
// exactly when the query is numeric, and customerName / customerPhone
// contains-insensitive always. Newest first with id tiebreak, paginated with
// a $transaction'd count (storefront listing idiom).

const CLIENT_SELECT = {select: {id: true, name: true, email: true}} as const;

// Order.number is an Int4 autoincrement — numeric queries beyond Int4 range
// can never match and would 500 inside Prisma if passed through.
const MAX_INT4 = 2_147_483_647;

/**
 * Which slice of the order book a view shows — one filter tab, in data terms.
 * The tabs are mutually exclusive: `archivedOnly` shows archived rows ONLY (so
 * the Archivées tab's count matches the rows under it), every other tab shows
 * live orders, optionally narrowed to one status.
 */
export type OrderScope = {
  status?: OrderStatus;
  archivedOnly: boolean;
};

export type ListOrdersParams = OrderScope & {
  q?: string;
  page: number;
  pageSize: number;
};

/** Scalar guard on the URL-sourced q before any Prisma filter. */
function searchWhere(raw: string | undefined): Prisma.OrderWhereInput | undefined {
  const q = typeof raw === 'string' ? raw.trim() : '';
  if (q.length === 0 || q.length > 200) return undefined;
  const or: Prisma.OrderWhereInput[] = [
    {customerName: {contains: q, mode: 'insensitive'}},
    {customerPhone: {contains: q, mode: 'insensitive'}}
  ];
  if (/^\d+$/.test(q)) {
    const number = Number.parseInt(q, 10);
    if (Number.isSafeInteger(number) && number <= MAX_INT4) or.push({number});
  }
  return {OR: or};
}

/**
 * THE where clause for an orders view. listOrders and getOrderStats both go
 * through it, which is what makes a tab's count and its rows the same question
 * asked twice — they cannot drift.
 */
function ordersWhere(params: OrderScope & {q?: string}): Prisma.OrderWhereInput {
  const filters: Prisma.OrderWhereInput[] = [
    params.archivedOnly ? {archivedAt: {not: null}} : {archivedAt: null}
  ];
  if (params.status) filters.push({status: params.status});
  const search = searchWhere(params.q);
  if (search) filters.push(search);
  return {AND: filters};
}

export async function listOrders(params: ListOrdersParams) {
  const where = ordersWhere(params);
  const [orders, total] = await prisma.$transaction([
    prisma.order.findMany({
      where,
      orderBy: [{createdAt: 'desc'}, {id: 'asc'}],
      include: {
        _count: {select: {items: true}},
        client: CLIENT_SELECT
      },
      ...pagingArgs(params)
    }),
    prisma.order.count({where})
  ]);
  return {orders, total};
}

export type OrderRow = Awaited<ReturnType<typeof listOrders>>['orders'][number];

export type OrderStats = {
  /** Live orders, every status — the default "Toutes" view. */
  all: number;
  /** Live orders per status; every status is present, zeroes included. */
  byStatus: Record<OrderStatus, number>;
  /** Archived orders — the ?archived=1 view, outside every other counter. */
  archived: number;
};

// The status list comes from the transition engine, never from a literal here,
// so a new status can never silently lose its tab.
const ORDER_STATUSES = Object.keys(ALLOWED_TRANSITIONS) as OrderStatus[];

/**
 * The filter-tab counters for the admin orders list, in ONE round trip: every
 * counter rides in the same `$transaction`, which gives them a single
 * read-consistent snapshot, so no two tabs can show figures from different
 * moments.
 *
 * Each counter is the row count of the view its tab links to — SAME
 * `ordersWhere`, including the active search, because the tab links carry `q`
 * forward. A tab therefore always predicts exactly what clicking it shows.
 * `all` is the sum of `byStatus` by construction (an order has exactly one
 * status), so the tabs can never add up to something the list denies.
 */
export async function getOrderStats({q}: {q?: string} = {}): Promise<OrderStats> {
  const [archived, ...perStatus] = await prisma.$transaction([
    prisma.order.count({where: ordersWhere({archivedOnly: true, q})}),
    ...ORDER_STATUSES.map((status) =>
      prisma.order.count({where: ordersWhere({archivedOnly: false, status, q})})
    )
  ]);

  // Every status gets a key, zeroes included: a tab showing 0 is information,
  // a tab that vanished is a moving target for the operator's mouse.
  const byStatus = {} as Record<OrderStatus, number>;
  let all = 0;
  ORDER_STATUSES.forEach((status, index) => {
    const count = perStatus[index];
    byStatus[status] = count;
    all += count;
  });
  return {all, byStatus, archived};
}

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

// My Orders (storefront): ONLY the given client's orders — the caller pins
// clientId from the session (never from user input), so no scalar guard is
// needed. Archived orders stay visible (a client's own history; admin archive
// is a back-office concern — same ruling as the client-detail page, Task 6).
// Newest first with id tiebreak, items included for the inline lines.
export async function listClientOrders(clientId: string) {
  return prisma.order.findMany({
    where: {clientId},
    orderBy: [{createdAt: 'desc'}, {id: 'asc'}],
    include: {items: {orderBy: {id: 'asc'}}}
  });
}

export type ClientOrder = Awaited<ReturnType<typeof listClientOrders>>[number];
