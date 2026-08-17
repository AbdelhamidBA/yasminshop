import {describe, expect, test} from 'vitest';
import {
  MIN_WHOLESALE_QTY,
  unitPriceForQty,
  unitsUntilWholesale,
  wholesaleApplies,
  wholesaleThreshold,
  type UnitPriceInput
} from './money';

// A 25.000 DT product with a 20.000 DT gros price from 5 units.
const base: UnitPriceInput = {
  priceMillimes: 25_000,
  discountPct: 0,
  massDiscountPct: null,
  wholesalePriceMillimes: 20_000,
  wholesaleMinQty: null,
  defaultMinQty: 5,
  qty: 1
};
const at = (overrides: Partial<UnitPriceInput>) => ({...base, ...overrides});

describe('wholesaleThreshold', () => {
  test('a product override beats the shop default', () => {
    expect(wholesaleThreshold(3, 5)).toBe(3);
    expect(wholesaleThreshold(null, 5)).toBe(5);
  });

  test('a threshold that cannot mean anything disables wholesale entirely', () => {
    // 0 or 1 would make the "wholesale" price the only price there is, which is
    // a pricing mistake, not a bulk deal. Infinity = never applies.
    for (const bad of [1, 0, -3, 2.5, Number.NaN]) {
      expect(wholesaleThreshold(bad, 5)).toBe(Number.POSITIVE_INFINITY);
    }
    expect(wholesaleThreshold(null, 0)).toBe(Number.POSITIVE_INFINITY);
    expect(wholesaleThreshold(null, 1)).toBe(Number.POSITIVE_INFINITY);
  });

  test('two is the smallest threshold that means anything', () => {
    expect(MIN_WHOLESALE_QTY).toBe(2);
    expect(wholesaleThreshold(2, 5)).toBe(2);
  });
});

describe('unitPriceForQty', () => {
  test('retail below the threshold, wholesale at and above it', () => {
    expect(unitPriceForQty(at({qty: 1}))).toBe(25_000);
    expect(unitPriceForQty(at({qty: 4}))).toBe(25_000);
    expect(unitPriceForQty(at({qty: 5}))).toBe(20_000);
    expect(unitPriceForQty(at({qty: 99}))).toBe(20_000);
  });

  test('a product without a gros price is always retail', () => {
    expect(unitPriceForQty(at({wholesalePriceMillimes: null, qty: 50}))).toBe(25_000);
  });

  test('a per-product threshold overrides the shop default', () => {
    expect(unitPriceForQty(at({wholesaleMinQty: 3, qty: 3}))).toBe(20_000);
    expect(unitPriceForQty(at({wholesaleMinQty: 10, qty: 5}))).toBe(25_000);
  });

  test('the per-product discount still sets the retail price below the threshold', () => {
    expect(unitPriceForQty(at({discountPct: 20, qty: 1}))).toBe(20_000);
    expect(unitPriceForQty(at({discountPct: 20, qty: 5}))).toBe(20_000);
  });

  test('NEVER charges more per unit for buying more', () => {
    // The shop set gros at 20.000 and later ran a 50% mass discount, taking
    // retail to 12.500. Charging the gros price there would mean the fifth unit
    // costs MORE than the fourth.
    const cheap = at({massDiscountPct: 50});
    expect(unitPriceForQty({...cheap, qty: 4})).toBe(12_500);
    expect(unitPriceForQty({...cheap, qty: 5})).toBe(12_500);
  });

  test('a gros price equal to retail changes nothing', () => {
    expect(unitPriceForQty(at({wholesalePriceMillimes: 25_000, qty: 9}))).toBe(25_000);
  });

  test('the price never rises as quantity rises, for any configuration', () => {
    // Property check across the whole grid: this is the invariant a customer
    // would notice being broken, and the one a future edit is most likely to
    // break.
    for (const wholesale of [null, 5_000, 20_000, 25_000, 40_000]) {
      for (const discountPct of [0, 20]) {
        for (const massDiscountPct of [null, 10, 90]) {
          for (const minQty of [null, 2, 3, 7]) {
            let previous = Number.POSITIVE_INFINITY;
            for (let qty = 1; qty <= 20; qty += 1) {
              const price = unitPriceForQty(
                at({wholesalePriceMillimes: wholesale, discountPct, massDiscountPct, wholesaleMinQty: minQty, qty})
              );
              expect(price).toBeLessThanOrEqual(previous);
              expect(Number.isInteger(price)).toBe(true);
              expect(price).toBeGreaterThanOrEqual(0);
              previous = price;
            }
          }
        }
      }
    }
  });
});

describe('wholesaleApplies', () => {
  test('true only when the gros price is reached AND is actually cheaper', () => {
    expect(wholesaleApplies(at({qty: 4}))).toBe(false);
    expect(wholesaleApplies(at({qty: 5}))).toBe(true);
    expect(wholesaleApplies(at({wholesalePriceMillimes: null, qty: 5}))).toBe(false);
    // Reached, but a mass discount already beats it — claiming it applies would
    // advertise a saving the customer is not getting.
    expect(wholesaleApplies(at({massDiscountPct: 50, qty: 5}))).toBe(false);
    expect(wholesaleApplies(at({wholesalePriceMillimes: 25_000, qty: 5}))).toBe(false);
  });
});

describe('unitsUntilWholesale', () => {
  test('counts down and stops at zero', () => {
    expect(unitsUntilWholesale(at({qty: 1}))).toBe(4);
    expect(unitsUntilWholesale(at({qty: 4}))).toBe(1);
    expect(unitsUntilWholesale(at({qty: 5}))).toBe(0);
    expect(unitsUntilWholesale(at({qty: 20}))).toBe(0);
  });

  test('promises nothing when there is nothing to promise', () => {
    expect(unitsUntilWholesale(at({wholesalePriceMillimes: null}))).toBe(0);
    // Threshold disabled by a bad configuration.
    expect(unitsUntilWholesale(at({wholesaleMinQty: 1}))).toBe(0);
    // A gros price that is not cheaper is not a deal worth nudging towards.
    expect(unitsUntilWholesale(at({massDiscountPct: 50, qty: 1}))).toBe(0);
    expect(unitsUntilWholesale(at({wholesalePriceMillimes: 30_000, qty: 1}))).toBe(0);
  });
});
