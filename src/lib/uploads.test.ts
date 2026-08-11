import {describe, expect, test} from 'vitest';
import {ALLOWED_IMAGE_TYPES, isSafeUploadPath, MAX_UPLOAD_BYTES} from './uploads';

describe('isSafeUploadPath', () => {
  test('accepts a normal nested path', () => {
    expect(isSafeUploadPath(['products', 'abc-123.webp'])).toBe(true);
  });
  test('rejects traversal segments', () => {
    expect(isSafeUploadPath(['..', 'secret'])).toBe(false);
    expect(isSafeUploadPath(['products', '..%2f..'])).toBe(false);
  });
  test('rejects empty and hidden segments', () => {
    expect(isSafeUploadPath([''])).toBe(false);
    expect(isSafeUploadPath(['.hidden'])).toBe(false);
  });
  test('rejects backslashes and separators inside segments', () => {
    expect(isSafeUploadPath(['a\\b.webp'])).toBe(false);
    expect(isSafeUploadPath(['a/b.webp'])).toBe(false);
  });
});

describe('constants', () => {
  test('allows the four image mime types', () => {
    expect([...ALLOWED_IMAGE_TYPES].sort()).toEqual([
      'image/avif', 'image/jpeg', 'image/png', 'image/webp'
    ]);
  });
  test('caps uploads at 8MB', () => {
    expect(MAX_UPLOAD_BYTES).toBe(8 * 1024 * 1024);
  });
});
