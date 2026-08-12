import {NextResponse} from 'next/server';
import {prisma} from '@/lib/db';
import {RATE_LIMITS, clientIpFromHeaders, enforceRateLimit} from '@/lib/rate-limit';

// Charset allowlist: product ids are cuids (lowercase alphanumeric); the
// hyphen is tolerated for slug-shaped values. This kills NUL bytes and
// lone-surrogate JSON strings — both crash PostgreSQL text parameters and
// would otherwise 500 inside Prisma — without creating an existence oracle.
const PRODUCT_ID_PATTERN = /^[a-z0-9-]{1,40}$/i;

// Public fire-and-forget counter behind the home page's "most searched"
// section. Abuse note: this endpoint is unauthenticated, so counter inflation
// is possible and ACCEPTED — the spec treats searchHits as a heuristic
// popularity signal, not an integrity-bearing metric.
export async function POST(request: Request) {
  // Unauthenticated public write — rate-limit by client IP. Over-limit → 429
  // with Retry-After (seconds) so a well-behaved client can back off.
  const ip = clientIpFromHeaders(request.headers);
  const rl = enforceRateLimit(
    `search-hits:${ip}`,
    RATE_LIMITS.searchHits.limit,
    RATE_LIMITS.searchHits.windowMs
  );
  if (!rl.allowed) {
    return NextResponse.json(
      {error: 'rateLimited'},
      {status: 429, headers: {'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000))}}
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({error: 'invalidJson'}, {status: 400});
  }
  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({error: 'invalidBody'}, {status: 400});
  }

  // Scalar guard on the raw client value before any Prisma filter (Phase 2
  // fix-wave idiom): object-shaped payloads like {productId: {not: ''}} must
  // 400 here and never reach the query below.
  const productId = (body as Record<string, unknown>).productId;
  if (typeof productId !== 'string' || !PRODUCT_ID_PATTERN.test(productId)) {
    return NextResponse.json({error: 'invalidProductId'}, {status: 400});
  }

  // Defense-in-depth (uploads-route idiom): the guard above should make this
  // unreachable, but an unexpected Prisma failure must not 500 a public
  // fire-and-forget endpoint — the contract is {ok: true} on any valid shape.
  try {
    await prisma.product.updateMany({
      where: {id: productId, archivedAt: null},
      data: {searchHits: {increment: 1}}
    });
  } catch {
    // Swallowed deliberately: heuristic counter, no caller acts on failure.
  }

  // Always ok on a valid shape — even when no row matched — so the endpoint
  // is not an existence oracle for product ids.
  return NextResponse.json({ok: true});
}
