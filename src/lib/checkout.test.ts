import {describe, expect, test} from 'vitest';
import {computeCartTotals, type CartTotalsInput} from './checkout';

function input(overrides: Partial<CartTotalsInput>): CartTotalsInput {
  return {
    items: [],
    promoPercentOff: null,
    deliveryCostMillimes: 7_000,
    freeDeliveryThresholdMillimes: 100_000,
    ...overrides
  };
}

describe('computeCartTotals', () => {
  test('no promo below threshold charges delivery', () => {
    const result = computeCartTotals(input({items: [{unitPriceMillimes: 10_000, qty: 2}]}));
    expect(result).toEqual({
      subtotalMillimes: 20_000,
      promoDiscountMillimes: 0,
      deliveryCostMillimes: 7_000,
      totalMillimes: 27_000
    });
  });

  test('promo keeping afterPromo over threshold gives free delivery (promo applies before the threshold test)', () => {
    const result = computeCartTotals(
      input({items: [{unitPriceMillimes: 75_000, qty: 2}], promoPercentOff: 10})
    );
    // subtotal 150 000, promo 15 000, afterPromo 135 000 ≥ 100 000 → free
    expect(result).toEqual({
      subtotalMillimes: 150_000,
      promoDiscountMillimes: 15_000,
      deliveryCostMillimes: 0,
      totalMillimes: 135_000
    });
  });

  test('promo dropping afterPromo below threshold still charges delivery', () => {
    const result = computeCartTotals(
      input({items: [{unitPriceMillimes: 105_000, qty: 1}], promoPercentOff: 10})
    );
    // subtotal 105 000 ≥ threshold, but afterPromo 94 500 < 100 000 → delivery charged
    expect(result).toEqual({
      subtotalMillimes: 105_000,
      promoDiscountMillimes: 10_500,
      deliveryCostMillimes: 7_000,
      totalMillimes: 101_500
    });
  });

  test('afterPromo exactly at the threshold gets free delivery (≥, not >)', () => {
    const result = computeCartTotals(input({items: [{unitPriceMillimes: 100_000, qty: 1}]}));
    expect(result).toEqual({
      subtotalMillimes: 100_000,
      promoDiscountMillimes: 0,
      deliveryCostMillimes: 0,
      totalMillimes: 100_000
    });
  });

  test('promo discount is rounded to the nearest millime', () => {
    // 10% of 9 990 → 999 (exact)
    const exact = computeCartTotals(
      input({items: [{unitPriceMillimes: 9_990, qty: 1}], promoPercentOff: 10})
    );
    expect(exact.promoDiscountMillimes).toBe(999);
    expect(exact.totalMillimes).toBe(9_990 - 999 + 7_000);

    // 15% of 9 990 = 1 498.5 → Math.round → 1 499 (not floor/trunc)
    const half = computeCartTotals(
      input({items: [{unitPriceMillimes: 9_990, qty: 1}], promoPercentOff: 15})
    );
    expect(half.promoDiscountMillimes).toBe(1_499);
    expect(half.totalMillimes).toBe(9_990 - 1_499 + 7_000);
  });

  test('empty cart returns all zeros with deliveryCost 0', () => {
    const result = computeCartTotals(input({promoPercentOff: 10}));
    expect(result).toEqual({
      subtotalMillimes: 0,
      promoDiscountMillimes: 0,
      deliveryCostMillimes: 0,
      totalMillimes: 0
    });
  });

  test('multi-line cart sums unitPrice × qty per line', () => {
    const result = computeCartTotals(
      input({
        items: [
          {unitPriceMillimes: 9_990, qty: 2},
          {unitPriceMillimes: 25_000, qty: 1},
          {unitPriceMillimes: 500, qty: 3}
        ]
      })
    );
    // 19 980 + 25 000 + 1 500 = 46 480 < threshold → delivery charged
    expect(result).toEqual({
      subtotalMillimes: 46_480,
      promoDiscountMillimes: 0,
      deliveryCostMillimes: 7_000,
      totalMillimes: 53_480
    });
  });
});
