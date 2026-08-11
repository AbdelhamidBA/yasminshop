import {NextResponse} from 'next/server';
import {prisma} from '@/lib/db';

const MAX_PRODUCT_ID_LENGTH = 40;

// Public fire-and-forget counter behind the home page's "most searched"
// section. Abuse note: this endpoint is unauthenticated, so counter inflation
// is possible and ACCEPTED — the spec treats searchHits as a heuristic
// popularity signal, not an integrity-bearing metric.
export async function POST(request: Request) {
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
  if (
    typeof productId !== 'string' ||
    productId.length === 0 ||
    productId.length > MAX_PRODUCT_ID_LENGTH
  ) {
    return NextResponse.json({error: 'invalidProductId'}, {status: 400});
  }

  await prisma.product.updateMany({
    where: {id: productId, archivedAt: null},
    data: {searchHits: {increment: 1}}
  });

  // Always ok on a valid shape — even when no row matched — so the endpoint
  // is not an existence oracle for product ids.
  return NextResponse.json({ok: true});
}
