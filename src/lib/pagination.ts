// Admin list pagination. Both values arrive from the URL, so both get the
// same scalar-guard treatment every other client-supplied value gets: an
// unparsable or out-of-range value falls back to the default rather than
// reaching Prisma as a huge `take` or a negative `skip`.

/** Offered in the rows-per-page control; nothing else is accepted. */
export const PAGE_SIZES = [10, 25, 50, 100] as const;

export const DEFAULT_PAGE_SIZE = 25;

/** 1-based page number; anything odd becomes page 1. */
export function parsePage(raw: unknown): number {
  if (typeof raw !== 'string' || !/^\d{1,6}$/.test(raw)) return 1;
  const page = Number.parseInt(raw, 10);
  return page >= 1 ? page : 1;
}

/** Only a value from PAGE_SIZES is honoured — never an arbitrary `take`. */
export function parsePageSize(raw: unknown): number {
  if (typeof raw !== 'string') return DEFAULT_PAGE_SIZE;
  const size = Number.parseInt(raw, 10);
  return (PAGE_SIZES as readonly number[]).includes(size) ? size : DEFAULT_PAGE_SIZE;
}

/**
 * The "1–25 of 57" figures, clamped to reality: an out-of-range page (a stale
 * link, or the last row of the last page being archived) reports an empty
 * range instead of counting past the total.
 */
export function pageRange(page: number, pageSize: number, total: number) {
  if (total <= 0) return {from: 0, to: 0};
  const from = Math.min((page - 1) * pageSize + 1, total);
  const to = Math.min(page * pageSize, total);
  return {from, to};
}

export function totalPages(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}
