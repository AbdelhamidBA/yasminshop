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

describe('message catalogs', () => {
  test('ar.json has exactly the same keys as fr.json', () => {
    expect(flattenKeys(ar).sort()).toEqual(flattenKeys(fr).sort());
  });

  test('no empty translations', () => {
    const empties = (catalog: Record<string, unknown>) =>
      flattenKeys(catalog).length > 0;
    expect(empties(fr)).toBe(true);
    expect(empties(ar)).toBe(true);
  });
});
