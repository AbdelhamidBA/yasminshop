import {describe, expect, test} from 'vitest';
import type {OrderStatus} from '@prisma/client';
import {
  bucketOrders,
  bucketWindowStart,
  computeDelta,
  previousRangeStart,
  rangeStart,
  type Range,
  type StatsOrder
} from './stats';

// Every boundary in stats.ts is computed in UTC so the buckets are deterministic
// regardless of the machine timezone — these tests pin those UTC boundaries.

const iso = (s: string): Date => new Date(s);

function order(createdAt: string, status: OrderStatus, totalMillimes: number): StatsOrder {
  return {createdAt: iso(createdAt), status, totalMillimes};
}

describe('rangeStart', () => {
  const now = iso('2026-08-12T13:30:00.000Z');

  test('day → start of the current UTC day', () => {
    expect(rangeStart('day', now).toISOString()).toBe('2026-08-12T00:00:00.000Z');
  });

  test('week → start of the day 6 days ago (trailing 7 days incl. today)', () => {
    expect(rangeStart('week', now).toISOString()).toBe('2026-08-06T00:00:00.000Z');
  });

  test('month → first of the current UTC month', () => {
    expect(rangeStart('month', now).toISOString()).toBe('2026-08-01T00:00:00.000Z');
  });

  test('year → Jan 1 of the current UTC year', () => {
    expect(rangeStart('year', now).toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('previousRangeStart (start of the prior equal-length comparison window)', () => {
  const now = iso('2026-08-12T13:30:00.000Z');

  test('day → the prior UTC day (window [prev, rangeStart) is 24h)', () => {
    expect(previousRangeStart('day', now).toISOString()).toBe('2026-08-11T00:00:00.000Z');
    // The prior window ends exactly where the current one starts.
    expect(rangeStart('day', now).toISOString()).toBe('2026-08-12T00:00:00.000Z');
  });

  test('week → 7 days before the trailing-7 window start', () => {
    // rangeStart('week') is 2026-08-06; the prior 7-day window starts a week earlier.
    expect(previousRangeStart('week', now).toISOString()).toBe('2026-07-30T00:00:00.000Z');
  });

  test('month → the first of the previous calendar month', () => {
    expect(previousRangeStart('month', now).toISOString()).toBe('2026-07-01T00:00:00.000Z');
  });

  test('month → underflows across the year boundary via Date.UTC', () => {
    const jan = iso('2026-01-15T10:00:00.000Z');
    expect(previousRangeStart('month', jan).toISOString()).toBe('2025-12-01T00:00:00.000Z');
  });

  test('year → Jan 1 of the previous UTC year', () => {
    expect(previousRangeStart('year', now).toISOString()).toBe('2025-01-01T00:00:00.000Z');
  });
});

describe('computeDelta (period-over-period % change, one decimal)', () => {
  test('returns null when the prior base is zero or negative (no comparison)', () => {
    expect(computeDelta(10, 0)).toBeNull();
    expect(computeDelta(0, 0)).toBeNull();
  });

  test('increase → positive pct with up direction', () => {
    expect(computeDelta(120, 100)).toEqual({pct: 20, direction: 'up'});
  });

  test('decrease → negative pct with down direction', () => {
    expect(computeDelta(80, 100)).toEqual({pct: -20, direction: 'down'});
  });

  test('no change → zero pct with flat direction', () => {
    expect(computeDelta(100, 100)).toEqual({pct: 0, direction: 'flat'});
  });

  test('rounds to a single decimal place', () => {
    expect(computeDelta(1186, 1000)).toEqual({pct: 18.6, direction: 'up'});
    // 1/3 → 33.33% rounds to 33.3.
    expect(computeDelta(4, 3)).toEqual({pct: 33.3, direction: 'up'});
  });
});

describe('bucketWindowStart (the chart x-axis span, may be wider than rangeStart)', () => {
  const now = iso('2026-08-12T13:30:00.000Z');

  test('day → exactly 24h before now', () => {
    expect(bucketWindowStart('day', now).toISOString()).toBe('2026-08-11T13:30:00.000Z');
  });

  test('week → start of the earliest of 7 daily buckets', () => {
    expect(bucketWindowStart('week', now).toISOString()).toBe('2026-08-06T00:00:00.000Z');
  });

  test('month → start of the earliest of 30 daily buckets', () => {
    expect(bucketWindowStart('month', now).toISOString()).toBe('2026-07-14T00:00:00.000Z');
  });

  test('year → Jan 1 of the current UTC year', () => {
    expect(bucketWindowStart('year', now).toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('bucketOrders — day (last 24h in 6×4h buckets)', () => {
  const now = iso('2026-08-12T13:30:00.000Z');

  test('produces 6 buckets labelled by each 4h boundary (UTC HH:MM)', () => {
    const buckets = bucketOrders([], 'day', now);
    expect(buckets.map((b) => b.label)).toEqual([
      '13:30',
      '17:30',
      '21:30',
      '01:30',
      '05:30',
      '09:30'
    ]);
    expect(buckets.every((b) => b.count === 0 && b.revenueMillimes === 0)).toBe(true);
  });

  test('assigns orders to the right bucket, sums CONFIRMED+DELIVERED revenue', () => {
    const orders: StatsOrder[] = [
      order('2026-08-11T13:30:00.000Z', 'CONFIRMED', 1000), // bucket 0 (window start, inclusive)
      order('2026-08-11T17:29:59.000Z', 'DELIVERED', 2000), // bucket 0 (just before the edge)
      order('2026-08-11T17:30:00.000Z', 'PENDING', 5000), //   bucket 1 (count only)
      order('2026-08-12T10:00:00.000Z', 'CANCELED', 9999), //  bucket 5 (count only)
      order('2026-08-12T13:30:00.000Z', 'CONFIRMED', 3000), // bucket 5 (== now, inclusive last edge)
      order('2026-08-11T13:29:59.000Z', 'CONFIRMED', 7777) //  before window → ignored
    ];
    const buckets = bucketOrders(orders, 'day', now);
    expect(buckets[0]).toEqual({label: '13:30', count: 2, revenueMillimes: 3000});
    expect(buckets[1]).toEqual({label: '17:30', count: 1, revenueMillimes: 0});
    expect(buckets[2]).toEqual({label: '21:30', count: 0, revenueMillimes: 0});
    expect(buckets[3]).toEqual({label: '01:30', count: 0, revenueMillimes: 0});
    expect(buckets[4]).toEqual({label: '05:30', count: 0, revenueMillimes: 0});
    expect(buckets[5]).toEqual({label: '09:30', count: 2, revenueMillimes: 3000});
  });

  test('only CONFIRMED+DELIVERED count as revenue; every status counts toward volume', () => {
    const orders: StatsOrder[] = [
      order('2026-08-12T13:00:00.000Z', 'PENDING', 1000),
      order('2026-08-12T13:00:00.000Z', 'CONFIRMED', 1000),
      order('2026-08-12T13:00:00.000Z', 'DELIVERED', 1000),
      order('2026-08-12T13:00:00.000Z', 'CANCELED', 1000)
    ];
    const last = bucketOrders(orders, 'day', now)[5];
    expect(last.count).toBe(4);
    expect(last.revenueMillimes).toBe(2000);
  });
});

describe('bucketOrders — week (7 daily buckets)', () => {
  const now = iso('2026-08-12T12:00:00.000Z');

  test('labels are the 7 trailing UTC days as MM-DD', () => {
    expect(bucketOrders([], 'week', now).map((b) => b.label)).toEqual([
      '08-06',
      '08-07',
      '08-08',
      '08-09',
      '08-10',
      '08-11',
      '08-12'
    ]);
  });

  test('buckets by calendar day, revenue filtered to CONFIRMED+DELIVERED', () => {
    const orders: StatsOrder[] = [
      order('2026-08-06T00:00:00.000Z', 'CONFIRMED', 1000), // day 0, start inclusive
      order('2026-08-06T23:59:59.000Z', 'DELIVERED', 500), //  day 0, end of day
      order('2026-08-09T06:00:00.000Z', 'PENDING', 8000), //   day 3, count only
      order('2026-08-12T12:00:00.000Z', 'CONFIRMED', 2000), // day 6 (today)
      order('2026-08-05T23:59:59.000Z', 'CONFIRMED', 999) //   before window → ignored
    ];
    const buckets = bucketOrders(orders, 'week', now);
    expect(buckets[0]).toEqual({label: '08-06', count: 2, revenueMillimes: 1500});
    expect(buckets[3]).toEqual({label: '08-09', count: 1, revenueMillimes: 0});
    expect(buckets[6]).toEqual({label: '08-12', count: 1, revenueMillimes: 2000});
    expect(buckets[1].count + buckets[2].count + buckets[4].count + buckets[5].count).toBe(0);
  });
});

describe('bucketOrders — month (30 daily buckets)', () => {
  const now = iso('2026-08-12T12:00:00.000Z');

  test('produces 30 daily buckets from 30 days ago through today', () => {
    const buckets = bucketOrders([], 'month', now);
    expect(buckets).toHaveLength(30);
    expect(buckets[0].label).toBe('07-14');
    expect(buckets[29].label).toBe('08-12');
  });

  test('assigns to the earliest and latest daily bucket, ignores out-of-window', () => {
    const orders: StatsOrder[] = [
      order('2026-07-14T00:00:00.000Z', 'DELIVERED', 1000), // bucket 0
      order('2026-08-12T11:59:59.000Z', 'CONFIRMED', 3000), // bucket 29 (today)
      order('2026-07-13T23:59:59.000Z', 'CONFIRMED', 500) //   before window → ignored
    ];
    const buckets = bucketOrders(orders, 'month', now);
    expect(buckets[0]).toEqual({label: '07-14', count: 1, revenueMillimes: 1000});
    expect(buckets[29]).toEqual({label: '08-12', count: 1, revenueMillimes: 3000});
  });
});

describe('bucketOrders — year (12 monthly buckets)', () => {
  const now = iso('2026-08-12T12:00:00.000Z');

  test('produces the 12 months of the current UTC year as YYYY-MM', () => {
    expect(bucketOrders([], 'year', now).map((b) => b.label)).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
      '2026-11',
      '2026-12'
    ]);
  });

  test('buckets by month; other calendar years are excluded', () => {
    const orders: StatsOrder[] = [
      order('2026-01-01T00:00:00.000Z', 'CONFIRMED', 1000), // Jan (bucket 0, start inclusive)
      order('2026-08-12T12:00:00.000Z', 'DELIVERED', 2000), // Aug (bucket 7)
      order('2026-12-31T23:59:59.000Z', 'PENDING', 5000), //   Dec (bucket 11, count only)
      order('2025-12-31T23:59:59.000Z', 'CONFIRMED', 9999), // prior year → ignored
      order('2027-01-01T00:00:00.000Z', 'CONFIRMED', 8888) //  next year (== window end) → ignored
    ];
    const buckets = bucketOrders(orders, 'year', now);
    expect(buckets[0]).toEqual({label: '2026-01', count: 1, revenueMillimes: 1000});
    expect(buckets[7]).toEqual({label: '2026-08', count: 1, revenueMillimes: 2000});
    expect(buckets[11]).toEqual({label: '2026-12', count: 1, revenueMillimes: 0});
    const others = buckets.filter((_, i) => ![0, 7, 11].includes(i));
    expect(others.every((b) => b.count === 0 && b.revenueMillimes === 0)).toBe(true);
  });
});

describe('bucketOrders — general invariants', () => {
  const ranges: Range[] = ['day', 'week', 'month', 'year'];
  const now = iso('2026-08-12T12:00:00.000Z');

  test('empty input yields all-zero buckets with the range-correct length', () => {
    const lengths = {day: 6, week: 7, month: 30, year: 12} as const;
    for (const range of ranges) {
      const buckets = bucketOrders([], range, now);
      expect(buckets).toHaveLength(lengths[range]);
      expect(buckets.every((b) => b.count === 0 && b.revenueMillimes === 0)).toBe(true);
    }
  });

  test('does not mutate the input order array', () => {
    const orders: StatsOrder[] = [order('2026-08-12T11:00:00.000Z', 'CONFIRMED', 1000)];
    const snapshot = [...orders];
    bucketOrders(orders, 'day', now);
    expect(orders).toEqual(snapshot);
  });
});
