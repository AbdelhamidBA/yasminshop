import {describe, expect, test} from 'vitest';
import {
  ALLOWED_TRANSITIONS,
  canTransition,
  stockDelta,
  type OrderStatus
} from './orders';

const STATUSES: OrderStatus[] = ['PENDING', 'CONFIRMED', 'DELIVERED', 'CANCELED'];

// The four allowed transitions per the spec status engine; everything else in
// the 4×4 matrix is forbidden (including self-transitions).
const VALID: Array<[OrderStatus, OrderStatus]> = [
  ['PENDING', 'CONFIRMED'],
  ['PENDING', 'CANCELED'],
  ['CONFIRMED', 'DELIVERED'],
  ['CONFIRMED', 'CANCELED']
];

function isValid(from: OrderStatus, to: OrderStatus): boolean {
  return VALID.some(([f, t]) => f === from && t === to);
}

describe('ALLOWED_TRANSITIONS', () => {
  test('covers every status as a key', () => {
    expect(Object.keys(ALLOWED_TRANSITIONS).sort()).toEqual([...STATUSES].sort());
  });

  test('matches the spec transition table exactly', () => {
    expect(ALLOWED_TRANSITIONS).toEqual({
      PENDING: ['CONFIRMED', 'CANCELED'],
      CONFIRMED: ['DELIVERED', 'CANCELED'],
      DELIVERED: [],
      CANCELED: []
    });
  });

  test('DELIVERED and CANCELED are terminal (no outgoing transitions)', () => {
    expect(ALLOWED_TRANSITIONS.DELIVERED).toEqual([]);
    expect(ALLOWED_TRANSITIONS.CANCELED).toEqual([]);
  });
});

describe('canTransition — full 4×4 matrix', () => {
  for (const from of STATUSES) {
    for (const to of STATUSES) {
      const expected = isValid(from, to);
      test(`${from} → ${to} is ${expected ? 'allowed' : 'forbidden'}`, () => {
        expect(canTransition(from, to)).toBe(expected);
      });
    }
  }
});

describe('stockDelta', () => {
  test('PENDING → CONFIRMED decrements stock', () => {
    expect(stockDelta('PENDING', 'CONFIRMED')).toBe('decrement');
  });

  test('CONFIRMED → CANCELED restocks', () => {
    expect(stockDelta('CONFIRMED', 'CANCELED')).toBe('restock');
  });

  test('PENDING → CANCELED has no stock effect (stock was never taken)', () => {
    expect(stockDelta('PENDING', 'CANCELED')).toBe('none');
  });

  test('CONFIRMED → DELIVERED has no stock effect (already decremented at confirm)', () => {
    expect(stockDelta('CONFIRMED', 'DELIVERED')).toBe('none');
  });

  test('every other pair in the matrix is none', () => {
    for (const from of STATUSES) {
      for (const to of STATUSES) {
        const special =
          (from === 'PENDING' && to === 'CONFIRMED') ||
          (from === 'CONFIRMED' && to === 'CANCELED');
        if (!special) expect(stockDelta(from, to)).toBe('none');
      }
    }
  });
});
