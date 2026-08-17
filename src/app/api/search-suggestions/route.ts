import {NextResponse} from 'next/server';
import {prisma} from '@/lib/db';
import {VISIBLE} from '@/server/storefront';

const MAX_SUGGESTIONS = 8;
// Same cap as the storefront list query: absurdly long inputs are not searched.
const MAX_QUERY_LENGTH = 200;

const NO_STORE = {'Cache-Control': 'no-store'} as const;

// Public suggestions endpoint for the header search box (Task 7).
export async function GET(request: Request) {
  const raw = request.url ? new URL(request.url).searchParams.get('q') : null;
  // Scalar guard on the URL-sourced value before any Prisma filter. NUL bytes
  // ("%00" decodes to U+0000) are rejected too: PostgreSQL cannot accept NUL
  // in text parameters, so letting one through would 500 inside Prisma.
  const q = typeof raw === 'string' ? raw.trim() : '';
  if (q.length < 2 || q.length > MAX_QUERY_LENGTH || q.includes('\u0000')) {
    return NextResponse.json({suggestions: []}, {headers: NO_STORE});
  }

  // Defense-in-depth (uploads-route idiom): the guard above should keep bad
  // input out of the query, but a public typeahead must degrade to an empty
  // list rather than 500 on an unexpected Prisma failure.
  let products;
  try {
    products = await prisma.product.findMany({
      // VISIBLE is ANDed alongside the search OR so its subcategory arm is
      // never clobbered (composition rule documented in @/server/storefront).
      where: {
        AND: [
          VISIBLE,
          {
            OR: [
              {nameFr: {contains: q, mode: 'insensitive'}},
              {nameAr: {contains: q, mode: 'insensitive'}},
              {reference: {contains: q, mode: 'insensitive'}}
            ]
          }
        ]
      },
      // Deterministic order (plan leaves it unspecified): newest first with
      // the storefront's stable id tiebreaker.
      orderBy: [{createdAt: 'desc'}, {id: 'asc'}],
      // ProductCardData-style select, minus quantity, with the first image
      // only ([sortOrder asc, id asc] — the storefront's stable ordering).
      select: {
        id: true,
        slug: true,
        nameFr: true,
        nameAr: true,
        priceMillimes: true,
        discountPct: true,
        // The admin's manual-order builder prices its lines from these
        // suggestions; without the gros fields its displayed total would
        // disagree with what createOrderCore actually charges.
        wholesalePriceMillimes: true,
        wholesaleMinQty: true,
        images: {
          select: {url: true},
          orderBy: [{sortOrder: 'asc'}, {id: 'asc'}],
          take: 1
        }
      },
      take: MAX_SUGGESTIONS
    });
  } catch {
    return NextResponse.json({suggestions: []}, {headers: NO_STORE});
  }

  const suggestions = products.map(({images, ...product}) => ({
    ...product,
    imageUrl: images[0]?.url ?? null
  }));
  return NextResponse.json({suggestions}, {headers: NO_STORE});
}
