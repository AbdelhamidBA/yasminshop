import {describe, expect, it} from 'vitest';
import {MAX_BULK_IDS, sanitizeIds} from './bulk';

describe('sanitizeIds', () => {
  it('accepts a plain id list', () => {
    expect(sanitizeIds(['abc123', 'def456'])).toEqual(['abc123', 'def456']);
  });

  it('de-duplicates', () => {
    expect(sanitizeIds(['abc123', 'abc123'])).toEqual(['abc123']);
  });

  it('rejects an empty selection rather than treating it as "everything"', () => {
    expect(sanitizeIds([])).toBeNull();
  });

  it('rejects non-arrays', () => {
    expect(sanitizeIds(null)).toBeNull();
    expect(sanitizeIds('abc123')).toBeNull();
    expect(sanitizeIds({0: 'abc123'})).toBeNull();
  });

  it('rejects anything that is not an id', () => {
    expect(sanitizeIds(['abc123', ''])).toBeNull();
    expect(sanitizeIds(['abc 123'])).toBeNull();
    expect(sanitizeIds(['abc123', 42])).toBeNull();
    expect(sanitizeIds(['a'.repeat(65)])).toBeNull();
  });

  it('accepts hyphens, matching the single-row id guards', () => {
    expect(sanitizeIds(['abc-123'])).toEqual(['abc-123']);
  });

  it('caps the batch size', () => {
    const ids = Array.from({length: MAX_BULK_IDS}, (_, i) => `id${i}`);
    expect(sanitizeIds(ids)).toHaveLength(MAX_BULK_IDS);
    expect(sanitizeIds([...ids, 'onemore'])).toBeNull();
  });
});
