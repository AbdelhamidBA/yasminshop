// Stock classification. The owner-configured `lastChanceThreshold` (admin
// Parameters) is the ONE definition of "low stock" in this codebase: it drives
// the storefront's "Plus que N en stock" section (getHomeSections), the admin
// products table's low-stock chip, and the products stats row. Kept pure and
// Prisma-free so the band can be unit-tested on its own.

/**
 * The IN-STOCK-BUT-LOW band, shaped as a Prisma numeric filter: strictly above
 * zero (zero is "out of stock" — a different state with its own tile) and at or
 * below the owner's threshold.
 *
 * Normalisation mirrors getHomeSections exactly: a threshold that is not a
 * positive integer collapses the band to `{gt: 0, lte: 0}`, which matches
 * nothing, rather than silently widening what counts as "low". Stock can never
 * go negative (the confirm-order decrement is guarded by `quantity >= qty`), so
 * the band and `quantity = 0` together cover every in-catalogue product.
 */
export function lowStockRange(lastChanceThreshold: number): {gt: number; lte: number} {
  const max =
    Number.isInteger(lastChanceThreshold) && lastChanceThreshold > 0 ? lastChanceThreshold : 0;
  return {gt: 0, lte: max};
}

/**
 * The two stock views the admin products list offers, as their `?stock=` URL
 * values: `out` is `quantity = 0`, `low` is the band above.
 */
export type StockFilter = 'out' | 'low';

/**
 * Scalar guard for the URL-sourced `?stock=` value — the same treatment `page`
 * and `per` get. Exactly 'out' or 'low' is honoured; anything else (absent, a
 * typo, the array a repeated query param produces) is ignored, so the list
 * falls back to its default view instead of reaching Prisma with junk.
 */
export function parseStockFilter(raw: unknown): StockFilter | undefined {
  return raw === 'out' || raw === 'low' ? raw : undefined;
}
