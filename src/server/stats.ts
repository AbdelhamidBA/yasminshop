import 'server-only';
import type {OrderStatus, Prisma} from '@prisma/client';
import {prisma} from '@/lib/db';
import {
  bucketOrders,
  bucketWindowStart,
  computeDelta,
  previousRangeStart,
  rangeStart,
  type Delta,
  type Range,
  type SalesBucket
} from '@/lib/stats';
import type {OrderRow} from '@/server/orders';

// Admin dashboard statistics (Phase 5). All figures exclude archived orders
// (archivedAt: null) — archiving removes an order from the active books — and,
// like the rest of the app, revenue counts CONFIRMED + DELIVERED only (spec
// finance intent: PENDING = pipeline, CANCELED = excluded). Money stays integer
// millimes throughout (summed in Prisma aggregates, formatted at render).
//
// Range scoping: the KPI figures (ordersTotal, revenueMillimes, pendingCount,
// statusBreakdown) and topProducts are scoped to rangeStart(range) so switching
// the range changes the numbers. clientsTotal and recentOrders are not
// range-scoped (a running total / the newest orders). The sales series spans
// the chart window (bucketWindowStart), which can be wider than rangeStart.

const REVENUE_STATUSES: OrderStatus[] = ['CONFIRMED', 'DELIVERED'];

const RECENT_ORDER_INCLUDE = {
  _count: {select: {items: true}},
  client: {select: {id: true, name: true, email: true}}
} satisfies Prisma.OrderInclude;

export type StatusBreakdown = Record<OrderStatus, number>;

export type TopProduct = {
  id: string;
  nameFr: string;
  nameAr: string;
  sold: number;
  revenueMillimes: number;
};

// Period-over-period deltas for the KPI tiles (reference-image alignment). Each
// is null when its prior-window base is empty (nothing to compare against) — the
// tile then renders no delta rather than a fabricated figure. revenue/orders are
// current-period vs prior-equal-window; clients is the growth of the active base
// over the period (new active clients ÷ base that predates the period).
export type DashboardDeltas = {
  revenue: Delta | null;
  orders: Delta | null;
  clients: Delta | null;
};

export type DashboardStats = {
  clientsTotal: number;
  ordersTotal: number;
  revenueMillimes: number;
  pendingCount: number;
  statusBreakdown: StatusBreakdown;
  salesSeries: SalesBucket[];
  topProducts: TopProduct[];
  recentOrders: OrderRow[];
  deltas: DashboardDeltas;
};

export async function getDashboardStats(range: Range): Promise<DashboardStats> {
  const now = new Date();
  const start = rangeStart(range, now);
  const prevStart = previousRangeStart(range, now);
  const orderWhere: Prisma.OrderWhereInput = {createdAt: {gte: start}, archivedAt: null};

  // One interactive transaction for a read-consistent snapshot. (The array form
  // of $transaction widens groupBy result types — Prisma limitation — so the
  // interactive form is used here to keep the aggregate typings precise.)
  const {grouped, prevGrouped, clientsTotal, newClientsInPeriod, chartOrders, topGrouped, recentOrders} =
    await prisma.$transaction(async (tx) => {
      const grouped = await tx.order.groupBy({
        by: ['status'],
        where: orderWhere,
        orderBy: {status: 'asc'},
        _count: {_all: true},
        _sum: {totalMillimes: true}
      });
      // Prior equal-length window [prevStart, start) — same status/archived rules
      // — so the tile deltas compare like with like.
      const prevGrouped = await tx.order.groupBy({
        by: ['status'],
        where: {createdAt: {gte: prevStart, lt: start}, archivedAt: null},
        orderBy: {status: 'asc'},
        _count: {_all: true},
        _sum: {totalMillimes: true}
      });
      const clientsTotal = await tx.user.count({
        where: {role: 'CLIENT', archivedAt: null}
      });
      // Active clients acquired within the current period — the numerator of the
      // client-base growth delta (base that predates the period = total − these).
      const newClientsInPeriod = await tx.user.count({
        where: {role: 'CLIENT', archivedAt: null, createdAt: {gte: start}}
      });
      const chartOrders = await tx.order.findMany({
        where: {createdAt: {gte: bucketWindowStart(range, now)}, archivedAt: null},
        select: {createdAt: true, totalMillimes: true, status: true}
      });
      const topGrouped = await tx.orderItem.groupBy({
        by: ['productId'],
        where: {
          order: {status: {in: REVENUE_STATUSES}, createdAt: {gte: start}, archivedAt: null}
        },
        _sum: {qty: true, lineTotalMillimes: true},
        orderBy: {_sum: {qty: 'desc'}},
        take: 5
      });
      const recentOrders = await tx.order.findMany({
        where: {archivedAt: null},
        orderBy: [{createdAt: 'desc'}, {id: 'asc'}],
        include: RECENT_ORDER_INCLUDE,
        take: 5
      });
      return {
        grouped,
        prevGrouped,
        clientsTotal,
        newClientsInPeriod,
        chartOrders,
        topGrouped,
        recentOrders
      };
    });

  const statusBreakdown: StatusBreakdown = {
    PENDING: 0,
    CONFIRMED: 0,
    DELIVERED: 0,
    CANCELED: 0
  };
  let ordersTotal = 0;
  let revenueMillimes = 0;
  for (const g of grouped) {
    const count = g._count._all;
    statusBreakdown[g.status] = count;
    ordersTotal += count;
    if (g.status === 'CONFIRMED' || g.status === 'DELIVERED') {
      revenueMillimes += g._sum.totalMillimes ?? 0;
    }
  }

  // Prior-window totals for the deltas (same CONFIRMED+DELIVERED revenue rule).
  let prevOrdersTotal = 0;
  let prevRevenueMillimes = 0;
  for (const g of prevGrouped) {
    prevOrdersTotal += g._count._all;
    if (g.status === 'CONFIRMED' || g.status === 'DELIVERED') {
      prevRevenueMillimes += g._sum.totalMillimes ?? 0;
    }
  }

  const deltas: DashboardDeltas = {
    revenue: computeDelta(revenueMillimes, prevRevenueMillimes),
    orders: computeDelta(ordersTotal, prevOrdersTotal),
    // Growth of the active client base over the period: total now vs the base
    // that predates the period (total − clients acquired this period).
    clients: computeDelta(clientsTotal, clientsTotal - newClientsInPeriod)
  };

  const salesSeries = bucketOrders(chartOrders, range, now);

  // groupBy loses the product names; a second lookup keyed by the ranked ids
  // fills them in while preserving the units-sold ordering.
  const productIds = topGrouped.map((g) => g.productId);
  const products =
    productIds.length > 0
      ? await prisma.product.findMany({
          where: {id: {in: productIds}},
          select: {id: true, nameFr: true, nameAr: true}
        })
      : [];
  const productById = new Map(products.map((p) => [p.id, p]));
  const topProducts: TopProduct[] = topGrouped.map((g) => {
    const p = productById.get(g.productId);
    return {
      id: g.productId,
      nameFr: p?.nameFr ?? '',
      nameAr: p?.nameAr ?? '',
      sold: g._sum.qty ?? 0,
      revenueMillimes: g._sum.lineTotalMillimes ?? 0
    };
  });

  return {
    clientsTotal,
    ordersTotal,
    revenueMillimes,
    pendingCount: statusBreakdown.PENDING,
    statusBreakdown,
    salesSeries,
    topProducts,
    recentOrders,
    deltas
  };
}
