import {describe, expect, test} from 'vitest';
import {effectivePriceMillimes, formatMillimes} from './money';

describe('effectivePriceMillimes', () => {
  test('no discount returns price unchanged', () => {
    expect(effectivePriceMillimes(10_000, 0, null)).toBe(10_000);
  });

  test('applies per-product discount', () => {
    expect(effectivePriceMillimes(10_000, 20, null)).toBe(8_000);
  });

  test('mass discount overrides per-product discount', () => {
    expect(effectivePriceMillimes(10_000, 20, 50)).toBe(5_000);
  });

  test('mass discount of 0 is an active override (cancels product discounts)', () => {
    expect(effectivePriceMillimes(10_000, 20, 0)).toBe(10_000);
  });

  test('rounds to the nearest millime', () => {
    // 9990 * 0.67 = 6693.3
    expect(effectivePriceMillimes(9_990, 33, null)).toBe(6_693);
  });
});

describe('formatMillimes', () => {
  test('formats dinars and millimes with 3 decimals', () => {
    expect(formatMillimes(7_500)).toBe('7.500');
  });

  test('groups thousands with spaces', () => {
    expect(formatMillimes(1_234_567)).toBe('1 234.567');
  });

  test('formats zero', () => {
    expect(formatMillimes(0)).toBe('0.000');
  });
});
