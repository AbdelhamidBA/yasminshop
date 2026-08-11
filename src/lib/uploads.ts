export const ALLOWED_IMAGE_TYPES: ReadonlySet<string> = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif'
]);

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const SEGMENT_RE = /^[a-z0-9][a-z0-9._-]*$/i;

export function isSafeUploadPath(segments: string[]): boolean {
  if (segments.length === 0) return false;
  return segments.every(
    (segment) =>
      SEGMENT_RE.test(segment) &&
      !segment.includes('..') &&
      !segment.includes('/') &&
      !segment.includes('\\')
  );
}
