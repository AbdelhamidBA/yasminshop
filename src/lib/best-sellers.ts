// Pure helpers for the home "Meilleures ventes" section. No Prisma, no React —
// src/server/storefront.ts feeds them real query results; unit-tested here.

// Fewer than this many REAL sellers → the section is topped up with featured
// products (real merchandising data — never fabricated placeholders).
export const BEST_SELLER_MIN = 4;

// Reorder `products` (fetched with an unspecified order via `id IN (...)`)
// back into the sales ranking carried by `rankedIds`. Ids without a matching
// product (archived/hidden — filtered out by the visibility query) are
// dropped; products not present in the ranking are dropped too.
export function orderByRankedIds<T extends {id: string}>(
  products: readonly T[],
  rankedIds: readonly string[]
): T[] {
  const byId = new Map(products.map((product) => [product.id, product]));
  const ordered: T[] = [];
  for (const id of rankedIds) {
    const product = byId.get(id);
    if (product !== undefined) {
      ordered.push(product);
      byId.delete(id); // a duplicated id can never yield a duplicated card
    }
  }
  return ordered;
}

// Honest fallback (§18): only when fewer than BEST_SELLER_MIN products have
// real sales is the remainder filled from `fallback` (featured products),
// deduped by id, capped at `limit`. With enough real sellers the list is
// returned as-is (sliced) — featured items are never mixed into a real
// sales ranking.
export function fillWithFallback<T extends {id: string}>(
  sellers: readonly T[],
  fallback: readonly T[],
  limit: number
): T[] {
  const max = Number.isInteger(limit) && limit > 0 ? limit : 0;
  const base = sellers.slice(0, max);
  if (base.length >= Math.min(BEST_SELLER_MIN, max)) return base;
  const seen = new Set(base.map((product) => product.id));
  const filled = [...base];
  for (const product of fallback) {
    if (filled.length >= max) break;
    if (seen.has(product.id)) continue;
    seen.add(product.id);
    filled.push(product);
  }
  return filled;
}
