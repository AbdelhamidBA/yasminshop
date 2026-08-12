import {describe, expect, test} from 'vitest';
import {BEST_SELLER_MIN, fillWithFallback, orderByRankedIds} from './best-sellers';

const p = (id: string) => ({id});

describe('orderByRankedIds', () => {
  test('restores the sales ranking regardless of fetch order', () => {
    const products = [p('b'), p('c'), p('a')];
    expect(orderByRankedIds(products, ['a', 'b', 'c'])).toEqual([p('a'), p('b'), p('c')]);
  });

  test('drops ranked ids whose product was filtered out (archived/hidden)', () => {
    expect(orderByRankedIds([p('b')], ['a', 'b', 'c'])).toEqual([p('b')]);
  });

  test('drops products missing from the ranking and dedupes repeated ids', () => {
    expect(orderByRankedIds([p('a'), p('x')], ['a', 'a'])).toEqual([p('a')]);
  });

  test('empty inputs yield an empty list', () => {
    expect(orderByRankedIds([], ['a'])).toEqual([]);
    expect(orderByRankedIds([p('a')], [])).toEqual([]);
  });
});

describe('fillWithFallback', () => {
  const featured = [p('f1'), p('f2'), p('f3'), p('f4'), p('f5')];

  test('enough real sellers → returned as-is, no featured mixed in', () => {
    const sellers = [p('s1'), p('s2'), p('s3'), p('s4')];
    expect(sellers.length).toBe(BEST_SELLER_MIN);
    expect(fillWithFallback(sellers, featured, 8)).toEqual(sellers);
  });

  test('fewer than the minimum → topped up with featured, capped at limit', () => {
    const sellers = [p('s1'), p('s2')];
    expect(fillWithFallback(sellers, featured, 4)).toEqual([
      p('s1'),
      p('s2'),
      p('f1'),
      p('f2')
    ]);
  });

  test('fallback entries already in the sellers list are deduped', () => {
    const sellers = [p('f1'), p('s1')];
    expect(fillWithFallback(sellers, featured, 4)).toEqual([
      p('f1'),
      p('s1'),
      p('f2'),
      p('f3')
    ]);
  });

  test('no sales at all → pure featured fallback', () => {
    expect(fillWithFallback([], featured, 3)).toEqual([p('f1'), p('f2'), p('f3')]);
  });

  test('sellers above the limit are sliced even when below the minimum', () => {
    const sellers = [p('s1'), p('s2'), p('s3')];
    expect(fillWithFallback(sellers, featured, 2)).toEqual([p('s1'), p('s2')]);
  });

  test('nonsensical limit yields an empty list', () => {
    expect(fillWithFallback([p('s1')], featured, 0)).toEqual([]);
    expect(fillWithFallback([p('s1')], featured, -1)).toEqual([]);
  });
});
