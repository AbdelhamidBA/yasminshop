import {describe, expect, it} from 'vitest';
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZES,
  pageRange,
  parsePage,
  parsePageSize,
  totalPages
} from './pagination';

describe('parsePage', () => {
  it('reads a plain page number', () => {
    expect(parsePage('3')).toBe(3);
  });

  it('falls back to 1 for anything unusable', () => {
    for (const raw of [undefined, null, '', '0', '-2', 'abc', '1.5', '9'.repeat(7), 12]) {
      expect(parsePage(raw)).toBe(1);
    }
  });
});

describe('parsePageSize', () => {
  it('accepts only the offered sizes', () => {
    for (const size of PAGE_SIZES) expect(parsePageSize(String(size))).toBe(size);
  });

  it('rejects an arbitrary take', () => {
    for (const raw of ['1000', '0', '-25', '26', 'all', undefined, 50]) {
      expect(parsePageSize(raw)).toBe(DEFAULT_PAGE_SIZE);
    }
  });
});

describe('pageRange', () => {
  it('reports the visible slice', () => {
    expect(pageRange(1, 25, 57)).toEqual({from: 1, to: 25});
    expect(pageRange(3, 25, 57)).toEqual({from: 51, to: 57});
  });

  it('is empty when there is nothing to show', () => {
    expect(pageRange(1, 25, 0)).toEqual({from: 0, to: 0});
  });

  it('clamps a page past the end instead of counting past the total', () => {
    expect(pageRange(99, 25, 57)).toEqual({from: 57, to: 57});
  });
});

describe('totalPages', () => {
  it('rounds up and never returns zero', () => {
    expect(totalPages(57, 25)).toBe(3);
    expect(totalPages(25, 25)).toBe(1);
    expect(totalPages(0, 25)).toBe(1);
  });
});
