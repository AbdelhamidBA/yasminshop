import 'server-only';
import type {OrderStatus, Prisma} from '@prisma/client';
import {prisma} from '@/lib/db';
import {
  bucketOrders,
  bucketWindowStart,
  rangeStart,
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

export type DashboardStats = {
  clientsTotal: number;
  ordersTotal: number;
  revenueMillimes: number;
  pendingCount: number;
  statusBreakdown: StatusBreakdown;
  salesSeries: SalesBucket[];
  topProducts: TopProduct[];
  recentOrders: OrderRow[];
};

export async function getDashboardStats(range: Range): Promise<DashboardStats> {
  const now = new Date();
  const start = rangeStart(range, now);
  const orderWhere: Prisma.OrderWhereInput = {createdAt: {gte: start}, archivedAt: null};

  // One interactive transaction for a read-consistent snapshot. (The array form
  // of $transaction widens groupBy result types — Prisma limitation — so the
  // interactive form is used here to keep the aggregate typings precise.)
  const {grouped, clientsTotal, chartOrders, topGrouped, recentOrders} =
    await prisma.$transaction(async (tx) => {
      const grouped = await tx.order.groupBy({
        by: ['status'],
        where: orderWhere,
        orderBy: {status: 'asc'},
        _count: {_all: true},
        _sum: {totalMillimes: true}
      });
      const clientsTotal = await tx.user.count({
        where: {role: 'CLIENT', archivedAt: null}
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
      return {grouped, clientsTotal, chartOrders, topGrouped, recentOrders};
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
    recentOrders
  };
}
