import type {OrderStatus} from '@prisma/client';

// Pure dashboard bucketing (Phase 5, TDD). No IO, no Date.now: every function
// takes an injected `now` so its boundaries are deterministic. All boundaries
// are computed in UTC so a bucket's edges never depend on the machine timezone
// (UTC days are exactly 86_400_000 ms — no DST seams). Money is integer
// millimes; revenue counts CONFIRMED + DELIVERED only (spec finance intent).

export type Range = 'day' | 'week' | 'month' | 'year';

export type StatsOrder = {createdAt: Date; totalMillimes: number; status: OrderStatus};

export type SalesBucket = {label: string; revenueMillimes: number; count: number};

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

// Revenue-eligible statuses: PENDING is pipeline, CANCELED is excluded.
const REVENUE_STATUSES: ReadonlySet<OrderStatus> = new Set(['CONFIRMED', 'DELIVERED']);

function startOfUtcDay(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function hourLabel(ms: number): string {
  const d = new Date(ms);
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

function dayLabel(ms: number): string {
  const d = new Date(ms);
  return `${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function monthLabel(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
}

// The KPI reporting period: today / trailing 7 days / this month / this year.
// Distinct from the chart span (see bucketWindowStart) — e.g. `day` here is the
// start of today, but the day chart spans a rolling 24h.
export function rangeStart(range: Range, now: Date): Date {
  const nowMs = now.getTime();
  switch (range) {
    case 'day':
      return new Date(startOfUtcDay(nowMs));
    case 'week':
      // Trailing 7 days = today plus the previous 6.
      return new Date(startOfUtcDay(nowMs) - 6 * DAY_MS);
    case 'month': {
      const d = new Date(nowMs);
      return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
    }
    case 'year': {
      const d = new Date(nowMs);
      return new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    }
  }
}

// The sales-chart x-axis span: the start of the earliest bucket. The server
// fetches orders from here for the series (wider than rangeStart for `day`
// and `month`, so no early bucket is starved of its data).
export function bucketWindowStart(range: Range, now: Date): Date {
  return new Date(buildBuckets(range, now)[0].startMs);
}

type BucketDef = {startMs: number; endMs: number; label: string};

function buildBuckets(range: Range, now: Date): BucketDef[] {
  const nowMs = now.getTime();
  if (range === 'day') {
    // Rolling last 24h in 6 × 4h buckets, anchored at `now`.
    const start = nowMs - 24 * HOUR_MS;
    return Array.from({length: 6}, (_, i) => {
      const s = start + i * 4 * HOUR_MS;
      return {startMs: s, endMs: s + 4 * HOUR_MS, label: hourLabel(s)};
    });
  }
  if (range === 'week' || range === 'month') {
    const days = range === 'week' ? 7 : 30;
    const start = startOfUtcDay(nowMs) - (days - 1) * DAY_MS;
    return Array.from({length: days}, (_, i) => {
      const s = start + i * DAY_MS;
      return {startMs: s, endMs: s + DAY_MS, label: dayLabel(s)};
    });
  }
  // year: the 12 calendar months of the current UTC year.
  const year = new Date(nowMs).getUTCFullYear();
  return Array.from({length: 12}, (_, m) => ({
    startMs: Date.UTC(year, m, 1),
    endMs: Date.UTC(year, m + 1, 1),
    label: monthLabel(Date.UTC(year, m, 1))
  }));
}

// Buckets orders into the range's time series. Orders outside the window are
// ignored. Each bucket's `count` is total order volume (any status) landing in
// it; `revenueMillimes` sums totalMillimes for CONFIRMED + DELIVERED only.
// Buckets are half-open [start, end); the day range additionally includes an
// order at exactly `now` (the window's trailing edge) in its last bucket.
export function bucketOrders(orders: StatsOrder[], range: Range, now: Date): SalesBucket[] {
  const defs = buildBuckets(range, now);
  const buckets: SalesBucket[] = defs.map((d) => ({
    label: d.label,
    revenueMillimes: 0,
    count: 0
  }));
  const windowStart = defs[0].startMs;
  const windowEnd = defs[defs.length - 1].endMs;

  for (const o of orders) {
    const t = o.createdAt.getTime();
    if (t < windowStart || t > windowEnd) continue;
    // Only `day` treats the trailing edge as inclusive (windowEnd === now);
    // for calendar ranges the edge is the start of a future period.
    if (t === windowEnd && range !== 'day') continue;

    let idx = defs.length - 1; // default catches t === windowEnd (day)
    for (let i = 0; i < defs.length; i++) {
      if (t >= defs[i].startMs && t < defs[i].endMs) {
        idx = i;
        break;
      }
    }

    buckets[idx].count += 1;
    if (REVENUE_STATUSES.has(o.status)) {
      buckets[idx].revenueMillimes += o.totalMillimes;
    }
  }
  return buckets;
}
