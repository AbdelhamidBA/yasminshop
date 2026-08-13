import {describe, expect, test} from 'vitest';
import {lowStockRange, parseStockFilter} from './inventory';

describe('lowStockRange', () => {
  test('spans "in stock but at or below the owner threshold"', () => {
    expect(lowStockRange(5)).toEqual({gt: 0, lte: 5});
    expect(lowStockRange(1)).toEqual({gt: 0, lte: 1});
  });

  test('never overlaps the out-of-stock state', () => {
    // gt: 0 — quantity 0 belongs to the out-of-stock counter, never to low stock.
    expect(lowStockRange(5).gt).toBe(0);
  });

  test('a threshold of 0 yields an empty band rather than swallowing zero stock', () => {
    // {gt: 0, lte: 0} is unsatisfiable: no product is both above and at zero.
    expect(lowStockRange(0)).toEqual({gt: 0, lte: 0});
  });

  test('rejects thresholds that are not positive integers', () => {
    const empty = {gt: 0, lte: 0};
    expect(lowStockRange(-3)).toEqual(empty);
    expect(lowStockRange(2.5)).toEqual(empty);
    expect(lowStockRange(Number.NaN)).toEqual(empty);
    expect(lowStockRange(Number.POSITIVE_INFINITY)).toEqual(empty);
  });

  test('matches the storefront last-chance band for the default threshold', () => {
    // getHomeSections filters last-chance products with exactly this shape, so
    // the admin "Stock bas" count and the storefront section can never diverge.
    expect(lowStockRange(5)).toEqual({gt: 0, lte: 5});
  });
});

describe('parseStockFilter', () => {
  test('honours exactly the two tab values', () => {
    expect(parseStockFilter('out')).toBe('out');
    expect(parseStockFilter('low')).toBe('low');
  });

  test('ignores anything else rather than passing it to Prisma', () => {
    // Absent, mis-cased, unknown, or the array a repeated ?stock= produces —
    // every one of them falls back to the default (all active) view.
    expect(parseStockFilter(undefined)).toBeUndefined();
    expect(parseStockFilter('')).toBeUndefined();
    expect(parseStockFilter('OUT')).toBeUndefined();
    expect(parseStockFilter('archived')).toBeUndefined();
    expect(parseStockFilter(['out'])).toBeUndefined();
    expect(parseStockFilter(0)).toBeUndefined();
    expect(parseStockFilter(null)).toBeUndefined();
  });
});
