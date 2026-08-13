import {describe, expect, test} from 'vitest';
import {lowStockRange} from './inventory';

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
