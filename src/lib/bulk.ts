// Bulk-action id handling. Every mass action reaches the server as a list of
// ids chosen by the client, so it gets the same scalar-guard treatment every
// other client-supplied value in this project gets before it touches Prisma:
// shape-checked, de-duplicated and capped.

/** Upper bound on one mass action — a page of rows, not the whole table. */
export const MAX_BULK_IDS = 100;

// Matches the id guard used by the single-row actions
// (/^[a-z0-9-]{1,40}$/i) so a mass action can never reject an id that the
// per-row path accepts. Slightly longer bound, hyphen allowed.
const ID_PATTERN = /^[a-z0-9-]{1,64}$/i;

/**
 * Returns a clean, de-duplicated id list, or null when the input is not a
 * plausible selection (empty, oversized, or containing anything that is not an
 * id). Null means "reject the request" — never "act on everything".
 */
export function sanitizeIds(raw: unknown): string[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_BULK_IDS) return null;
  const seen = new Set<string>();
  for (const value of raw) {
    if (typeof value !== 'string' || !ID_PATTERN.test(value)) return null;
    seen.add(value);
  }
  return seen.size === 0 ? null : [...seen];
}
