import {NextResponse} from 'next/server';
import {auth} from '@/auth';
import {prisma} from '@/lib/db';
import {sessionRevoked} from '@/server/authz';

// POST /api/push/unsubscribe — remove this device's subscription (staff toggle
// off, or a browser that revoked permission). Same route-boundary authz as
// subscribe. Delete by the unique endpoint; deleteMany makes an already-gone row
// a no-op (no P2025 to handle) and never leaks which endpoints exist.

const MAX_ENDPOINT = 2000;

// True if the string contains any C0 control character (code < 0x20), incl. NUL
// (which Postgres text parameters cannot hold).
function hasControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) < 0x20) return true;
  }
  return false;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({error: 'unauthorized'}, {status: 401});
  const role = session.user.role;
  if (role !== 'ADMIN' && role !== 'SUB_ADMIN') {
    return NextResponse.json({error: 'forbidden'}, {status: 403});
  }
  // Revocation re-check: a reset/archive/role-change invalidates a live token.
  if (await sessionRevoked(session)) {
    return NextResponse.json({error: 'unauthorized'}, {status: 401});
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({error: 'invalidJson'}, {status: 400});
  }

  const endpoint = (body as Record<string, unknown> | null)?.endpoint;
  if (
    typeof endpoint !== 'string' ||
    endpoint.length < 1 ||
    endpoint.length > MAX_ENDPOINT ||
    hasControlChar(endpoint)
  ) {
    return NextResponse.json({error: 'invalidEndpoint'}, {status: 400});
  }

  await prisma.pushSubscription.deleteMany({where: {endpoint}});
  return NextResponse.json({ok: true});
}
