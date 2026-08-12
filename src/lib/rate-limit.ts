// Small fixed-window rate limiter for the unauthenticated public write surfaces
// (register, password-reset request, place-order, promo-check, search-hits).
//
// The core `checkRateLimit` is PURE — it takes the store, the clock (`now`) and
// the window/limit explicitly — so it is fully unit-testable without timers or a
// server. The process-level convenience below owns a single in-memory Map.
//
// MULTI-INSTANCE CAVEAT: the store is per-process memory. This is deliberate and
// sufficient for the single-instance VPS target (one Node process behind the
// proxy). Behind multiple instances / a load balancer each process would keep
// its own counters, so a client could get up to `limit × instances` before being
// throttled — a shared store (Redis, or a DB table) would be required there.

export type RateLimitEntry = {count: number; resetAt: number};
export type RateLimitStore = Map<string, RateLimitEntry>;
export type RateLimitResult = {allowed: boolean; retryAfterMs: number};

// One fixed-window decision. A key's window opens on its first request and runs
// for `windowMs`; up to `limit` requests are allowed within it, after which the
// key is blocked until `now` reaches `resetAt`. At/after `resetAt` the window
// rolls over and a fresh allowance begins.
export function checkRateLimit(
  store: RateLimitStore,
  key: string,
  limit: number,
  windowMs: number,
  now: number
): RateLimitResult {
  const entry = store.get(key);
  if (!entry || now >= entry.resetAt) {
    store.set(key, {count: 1, resetAt: now + windowMs});
    return {allowed: true, retryAfterMs: 0};
  }
  if (entry.count < limit) {
    entry.count += 1;
    return {allowed: true, retryAfterMs: 0};
  }
  return {allowed: false, retryAfterMs: entry.resetAt - now};
}

// Process-wide store. Grows by one entry per distinct key; stale entries are
// overwritten on the next request for that key after their window rolls over, so
// the map stays bounded by the count of *active* keys (fine for the VPS target).
const store: RateLimitStore = new Map();

// Convenience wrapper over the pure check using the module store and the real
// clock. Callers pass a namespaced key (e.g. `register:1.2.3.4`).
export function enforceRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  return checkRateLimit(store, key, limit, windowMs, Date.now());
}

// Best-effort client IP from proxy headers. `x-forwarded-for` is a comma list
// (client first); `x-real-ip` is the common single-value fallback. When neither
// is present (or blank) we bucket everything under a constant so the limiter
// still degrades to a global cap rather than silently disabling itself.
export function clientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    // First non-empty entry (a malformed leading empty entry is skipped).
    for (const part of forwarded.split(',')) {
      const trimmed = part.trim();
      if (trimmed) return trimmed;
    }
  }
  const real = headers.get('x-real-ip')?.trim();
  if (real) return real;
  return 'unknown';
}

// Per-surface limits (requests per window). Windows are 60s. Public writes are
// low-frequency for a legitimate user, so these are generous enough not to trip
// on normal use (or the e2e suite) while still capping scripted abuse.
export const RATE_LIMITS = {
  register: {limit: 10, windowMs: 60_000},
  passwordReset: {limit: 10, windowMs: 60_000},
  placeOrder: {limit: 30, windowMs: 60_000},
  checkPromo: {limit: 30, windowMs: 60_000},
  searchHits: {limit: 60, windowMs: 60_000}
} as const;
