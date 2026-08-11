import {describe, expect, test} from 'vitest';
import {
  effectivePriceMillimes,
  formatMillimes,
  MAX_MILLIMES,
  millimesToInput,
  parseDinarsToMillimes
} from './money';

describe('MAX_MILLIMES', () => {
  test('is 2 billion millimes, safely under the Int4 max', () => {
    expect(MAX_MILLIMES).toBe(2_000_000_000);
    expect(MAX_MILLIMES).toBeLessThan(2_147_483_647);
  });
});

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

describe('parseDinarsToMillimes', () => {
  test('parses whole dinars', () => {
    expect(parseDinarsToMillimes('12')).toBe(12_000);
  });
  test('parses dot decimals up to 3 places', () => {
    expect(parseDinarsToMillimes('12.5')).toBe(12_500);
    expect(parseDinarsToMillimes('0.05')).toBe(50);
    expect(parseDinarsToMillimes('89.000')).toBe(89_000);
  });
  test('accepts comma as decimal separator', () => {
    expect(parseDinarsToMillimes('7,250')).toBe(7_250);
  });
  test('rejects more than 3 decimals, negatives, and garbage', () => {
    expect(parseDinarsToMillimes('1.2345')).toBeNull();
    expect(parseDinarsToMillimes('-1')).toBeNull();
    expect(parseDinarsToMillimes('abc')).toBeNull();
    expect(parseDinarsToMillimes('')).toBeNull();
  });
});

describe('millimesToInput', () => {
  test('renders plain 3-decimal form values', () => {
    expect(millimesToInput(89_000)).toBe('89.000');
    expect(millimesToInput(50)).toBe('0.050');
  });
});
