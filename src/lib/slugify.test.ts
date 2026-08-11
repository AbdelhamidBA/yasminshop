import {describe, expect, test} from 'vitest';
import {ensureUniqueSlug, slugify} from './slugify';

describe('slugify', () => {
  test('lowercases and hyphenates', () => {
    expect(slugify('Casque Sans Fil')).toBe('casque-sans-fil');
  });
  test('strips French accents', () => {
    expect(slugify('Électronique & Té1é')).toBe('electronique-te1e');
  });
  test('returns empty string for pure Arabic input', () => {
    expect(slugify('إلكترونيات')).toBe('');
  });
  test('trims leading/trailing hyphens', () => {
    expect(slugify('--Promo!--')).toBe('promo');
  });
});

describe('ensureUniqueSlug', () => {
  test('returns the base when free', async () => {
    expect(await ensureUniqueSlug('audio', async () => false)).toBe('audio');
  });
  test('appends -2 then -3 while taken', async () => {
    const taken = new Set(['audio', 'audio-2']);
    expect(await ensureUniqueSlug('audio', async (s) => taken.has(s))).toBe('audio-3');
  });
  test('falls back to "item" for an empty base', async () => {
    expect(await ensureUniqueSlug('', async () => false)).toBe('item');
  });
});
