import {describe, expect, test} from 'vitest';
import ar from '../../messages/ar.json';
import fr from '../../messages/fr.json';

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value !== null && typeof value === 'object'
      ? flattenKeys(value as Record<string, unknown>, path)
      : [path];
  });
}

function flattenValues(obj: Record<string, unknown>): unknown[] {
  return Object.values(obj).flatMap((value) =>
    value !== null && typeof value === 'object'
      ? flattenValues(value as Record<string, unknown>)
      : [value]
  );
}

describe('message catalogs', () => {
  test('ar.json has exactly the same keys as fr.json', () => {
    expect(flattenKeys(ar).sort()).toEqual(flattenKeys(fr).sort());
  });

  test('every leaf value is a non-empty string', () => {
    const assertAllNonEmpty = (catalog: Record<string, unknown>) => {
      for (const value of flattenValues(catalog)) {
        expect(typeof value).toBe('string');
        expect((value as string).length).toBeGreaterThan(0);
      }
    };
    assertAllNonEmpty(fr);
    assertAllNonEmpty(ar);
  });
});
