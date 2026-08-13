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

// Arabic was removed from the product; messages/ar.json is kept on disk so the
// locale can be switched back on without re-translating, but it is no longer
// shipped and is allowed to drift behind fr.json. French is the only catalogue
// that must stay complete — these tests guard THAT.
describe('message catalogs', () => {
  test('fr.json has no empty leaves', () => {
    for (const value of flattenValues(fr)) {
      expect(typeof value).toBe('string');
      expect((value as string).length).toBeGreaterThan(0);
    }
  });

  test('fr.json has no duplicate key paths', () => {
    const keys = flattenKeys(fr);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test('the parked ar.json is still valid JSON with non-empty leaves', () => {
    const keys = flattenKeys(ar);
    expect(keys.length).toBeGreaterThan(0);
    for (const value of flattenValues(ar)) {
      expect(typeof value).toBe('string');
      expect((value as string).length).toBeGreaterThan(0);
    }
  });
});
