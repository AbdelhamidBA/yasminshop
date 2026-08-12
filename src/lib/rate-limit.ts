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

// Pure sweep: drop every entry whose window has already elapsed at `now`. Kept
// separate from checkRateLimit (and pure) so it stays unit-testable and the
// process wrapper can call it on a cadence rather than on every request.
export function pruneExpired(store: RateLimitStore, now: number): void {
  for (const [key, entry] of store) {
    if (now >= entry.resetAt) store.delete(key);
  }
}

// Process-wide store. Without pruning it would grow one entry per distinct key
// forever: a rolled-over window is only reclaimed if that same key returns, so
// keys that never recur (IP churn, one-off scripted probes) would leak. We sweep
// expired entries on a cadence — every SWEEP_EVERY writes — bounding the map to
// roughly the count of keys active within a single window. The sweep is O(n) but
// amortized across SWEEP_EVERY calls (fine for the single-instance VPS target).
const store: RateLimitStore = new Map();
const SWEEP_EVERY = 500;
let writesSinceSweep = 0;

// Convenience wrapper over the pure check using the module store and the real
// clock. Callers pass a namespaced key (e.g. `register:1.2.3.4`).
export function enforceRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  if (++writesSinceSweep >= SWEEP_EVERY) {
    writesSinceSweep = 0;
    pruneExpired(store, now);
  }
  return checkRateLimit(store, key, limit, windowMs, now);
}

// Best-effort client IP from proxy headers under a SINGLE-TRUSTED-PROXY
// assumption (the VPS target: exactly one reverse proxy — nginx/Caddy — in front
// of this Node process). `x-forwarded-for` is a comma list that each hop
// APPENDS to, so the RIGHTMOST entry is the address our own trusted proxy
// observed and added; entries further left are attacker-controllable (a client
// can pre-seed the header before it reaches the proxy) and must NOT be trusted
// for the limiter key. Taking the rightmost non-empty hop makes the key
// un-spoofable in this topology. `x-real-ip` (a single value the proxy sets) is
// the fallback; absent both (or blank) we bucket everything under a constant so
// the limiter degrades to a global cap rather than silently disabling itself.
//
// MULTI-PROXY CAVEAT: behind more than one chained proxy the rightmost hop is the
// nearest proxy, not the client — such a deployment must widen this to skip its
// own known proxy hops (or set a trusted `x-real-ip`).
export function clientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    // Rightmost non-empty entry — the hop appended by our trusted proxy.
    const parts = forwarded.split(',');
    for (let i = parts.length - 1; i >= 0; i--) {
      const trimmed = parts[i].trim();
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
  // Credentials sign-in: caps flooded login attempts per IP as basic brute-force
  // defence-in-depth (each attempt also pays the bcrypt verify cost). Generous
  // enough that a human — or the e2e suite's handful of logins — never trips it;
  // production behind a shared store / proxy-level throttle would tighten this.
  login: {limit: 30, windowMs: 60_000},
  placeOrder: {limit: 30, windowMs: 60_000},
  checkPromo: {limit: 30, windowMs: 60_000},
  searchHits: {limit: 60, windowMs: 60_000}
} as const;
