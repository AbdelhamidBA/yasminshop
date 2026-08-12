// Pure notification helpers (no DB, no `server-only`) so the payload shape is
// parsed identically on the server, in client leaves, and in unit tests. The
// Notification.payload column is Prisma Json (unknown at the type level); this
// guards it before any rendering. NEW_ORDER is the only type emitted today
// (createOrderCore at src/server/create-order.ts); the parser returns null for
// anything malformed so the UI can fall back to a generic label.

export const NEW_ORDER = 'NEW_ORDER';

export type NewOrderPayload = {
  orderId: string;
  number: number;
  totalMillimes: number;
};

// cuid charset allowlist (Phase 2 fix-wave scalar-guard idiom): the orderId
// becomes an href (/admin/orders/[orderId]) and a Prisma filter, so it is
// bounded to the cuid charset before it is ever trusted — this kills NUL bytes
// / lone surrogates smuggled through the JSON payload column.
const ORDER_ID_PATTERN = /^[a-z0-9-]{1,40}$/i;

export function parseNewOrderPayload(payload: unknown): NewOrderPayload | null {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.orderId !== 'string' || !ORDER_ID_PATTERN.test(p.orderId)) return null;
  if (typeof p.number !== 'number' || !Number.isInteger(p.number)) return null;
  if (typeof p.totalMillimes !== 'number' || !Number.isInteger(p.totalMillimes)) return null;
  return {orderId: p.orderId, number: p.number, totalMillimes: p.totalMillimes};
}
