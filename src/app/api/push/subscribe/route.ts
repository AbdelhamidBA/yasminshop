import {NextResponse} from 'next/server';
import type {Prisma} from '@prisma/client';
import {auth} from '@/auth';
import {prisma} from '@/lib/db';
import {sessionRevoked} from '@/server/authz';

// POST /api/push/subscribe — staff store their browser push subscription so
// new-order alerts can reach this device. requireStaff role set enforced at the
// route boundary (the intl middleware excludes /api, so route handlers own their
// own authz): 401 when signed out, 403 for a CLIENT. Upsert by the unique
// endpoint so re-subscribing the same device is idempotent and re-homes it to
// the current staff user.

// A push endpoint is an https URL from the browser's push service; keys are the
// base64url {p256dh, auth} pair. Bounds + charset keep oversized / control-char
// (NUL crashes Postgres text params) payloads out of the DB (scalar-guard idiom).
const MAX_ENDPOINT = 2000;
// base64url charset (optionally '='-padded); also rejects control chars/injection.
const KEY_PATTERN = /^[A-Za-z0-9_\-=]{1,500}$/;

type ParsedSubscription = {endpoint: string; keys: {p256dh: string; auth: string}};

// True if the string contains any C0 control character (code < 0x20), incl. NUL.
function hasControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) < 0x20) return true;
  }
  return false;
}

function isValidEndpoint(endpoint: unknown): endpoint is string {
  return (
    typeof endpoint === 'string' &&
    endpoint.length >= 1 &&
    endpoint.length <= MAX_ENDPOINT &&
    endpoint.startsWith('https://') &&
    !hasControlChar(endpoint)
  );
}

function parseSubscription(body: unknown): ParsedSubscription | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;

  if (!isValidEndpoint(b.endpoint)) return null;

  const keys = b.keys;
  if (typeof keys !== 'object' || keys === null) return null;
  const k = keys as Record<string, unknown>;
  const {p256dh, auth} = k;
  if (
    typeof p256dh !== 'string' ||
    !KEY_PATTERN.test(p256dh) ||
    typeof auth !== 'string' ||
    !KEY_PATTERN.test(auth)
  ) {
    return null;
  }

  return {endpoint: b.endpoint, keys: {p256dh, auth}};
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

  const parsed = parseSubscription(body);
  if (parsed === null) {
    return NextResponse.json({error: 'invalidSubscription'}, {status: 400});
  }

  await prisma.pushSubscription.upsert({
    where: {endpoint: parsed.endpoint},
    update: {keysJson: parsed.keys as Prisma.InputJsonValue, userId: session.user.id},
    create: {
      endpoint: parsed.endpoint,
      keysJson: parsed.keys as Prisma.InputJsonValue,
      userId: session.user.id
    }
  });

  return NextResponse.json({ok: true});
}
