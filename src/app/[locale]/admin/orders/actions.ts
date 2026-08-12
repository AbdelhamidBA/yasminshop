'use server';

import {Prisma} from '@prisma/client';
import {revalidatePath} from 'next/cache';
import {failure, fieldErrorsFromZod, success, type ActionResult} from '@/lib/action-result';
import {AuthzError} from '@/lib/authz';
import {prisma} from '@/lib/db';
import {canTransition, stockDelta, type OrderStatus} from '@/lib/orders';
import {checkoutSchema} from '@/lib/schemas/checkout';
import {requireAdmin, requireStaff} from '@/server/authz';
import {createOrderCore, parseOrderLines} from '@/server/create-order';
import {validatePromoCode} from '@/server/promo';

const PATH = '/[locale]/admin/orders';

// Order ids are cuids; same charset allowlist as the checkout scalar guards
// (Phase 2 fix-wave idiom) — applied to EVERY client-supplied id.
const ID_PATTERN = /^[a-z0-9-]{1,40}$/i;

const ORDER_STATUSES: readonly string[] = ['PENDING', 'CONFIRMED', 'DELIVERED', 'CANCELED'];

// Bounded retry for the confirm/cancel transaction on a Postgres write conflict
// / deadlock (Prisma P2034). Postgres aborts one side of a genuine deadlock; the
// transaction re-reads stock on each attempt, so a retry is safe. Exhausting the
// budget surfaces a typed 'conflict' failure instead of a 500.
const MAX_TX_ATTEMPTS = 3;

function isPrismaError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

// Sentinel thrown INSIDE the interactive transaction to abort it — Prisma
// rolls the whole transaction back on any throw, so no partial stock write
// can survive. It is caught OUTSIDE the transaction and mapped to the typed
// failure it carries (never leaks to the client as a thrown error).
class TransitionAbort extends Error {
  constructor(readonly reason: 'insufficientStock' | 'invalidTransition') {
    super(reason);
    this.name = 'TransitionAbort';
  }
}

// Status change is the one order mutation open to SUB_ADMIN (requireStaff).
export async function changeOrderStatus(id: string, to: OrderStatus): Promise<ActionResult> {
  try {
    await requireStaff();
    if (typeof id !== 'string' || !ID_PATTERN.test(id)) return failure('notFound');
    if (typeof to !== 'string' || !ORDER_STATUSES.includes(to)) return failure('validation');

    const order = await prisma.order.findUnique({
      where: {id},
      select: {status: true, archivedAt: true, items: {select: {productId: true, qty: true}}}
    });
    if (!order) return failure('notFound');
    // Distinct signal for an archived order (view-only) vs a genuinely illegal
    // transition — the UI hides status buttons on archived orders, so this only
    // fires for a crafted/stale POST, but the message should still be honest.
    if (order.archivedAt !== null) return failure('orderArchived');
    if (!canTransition(order.status, to)) return failure('invalidTransition');

    // Deterministic lock order (deadlock hardening): acquire the per-product row
    // locks in a stable productId order so two concurrent confirms that share
    // products can never hold-and-wait in opposite orders (the classic ABBA
    // deadlock). Same set of writes — only the sequence is pinned.
    const orderedItems = [...order.items].sort((a, b) =>
      a.productId < b.productId ? -1 : a.productId > b.productId ? 1 : 0
    );

    // Promo policy at confirm (binding): HONOR THE SNAPSHOT. Totals — promo
    // discount included — were frozen at order creation; the code is NOT
    // re-validated here even if it has since expired, been deactivated or
    // archived.
    const delta = stockDelta(order.status, to);
    const runTransition = () =>
      prisma.$transaction(async (tx) => {
        if (delta === 'decrement') {
          for (const item of orderedItems) {
            // §6d binding: stock re-check INSIDE the decrement transaction —
            // reload each product within the tx and reject if it is archived
            // (or gone) or the line qty exceeds its current stock.
            const product = await tx.product.findUnique({
              where: {id: item.productId},
              select: {quantity: true, archivedAt: true}
            });
            if (!product || product.archivedAt !== null || item.qty > product.quantity) {
              throw new TransitionAbort('insufficientStock');
            }
            // Conditional updateMany re-states the check in the WHERE: under
            // READ COMMITTED a concurrent confirm can commit between our read
            // and this write, and the re-evaluated row must still satisfy it —
            // count 0 aborts instead of driving the quantity negative.
            const updated = await tx.product.updateMany({
              where: {id: item.productId, archivedAt: null, quantity: {gte: item.qty}},
              data: {quantity: {decrement: item.qty}}
            });
            if (updated.count === 0) throw new TransitionAbort('insufficientStock');
          }
        } else if (delta === 'restock') {
          // Restock on CONFIRMED→CANCELED re-adds stock even when a product
          // has been archived since — the units physically return either way.
          for (const item of orderedItems) {
            await tx.product.updateMany({
              where: {id: item.productId},
              data: {quantity: {increment: item.qty}}
            });
          }
        }
        // Guarded status write: the WHERE pins the status we validated the
        // transition from, plus the archived backstop (Task 3 review fix):
        // archived orders are view-only in the UI, and this keeps a crafted
        // staff POST from transitioning one either. A concurrent status
        // change (or archive) makes this count 0 — abort so the stock
        // effects above roll back with it.
        const updated = await tx.order.updateMany({
          where: {id, status: order.status, archivedAt: null},
          data: {status: to}
        });
        if (updated.count === 0) throw new TransitionAbort('invalidTransition');
      });

    try {
      // Retry ONLY on a write-conflict/deadlock (P2034); a TransitionAbort or any
      // other error breaks out immediately and is handled below.
      for (let attempt = 1; ; attempt++) {
        try {
          await runTransition();
          break;
        } catch (error) {
          if (isPrismaError(error, 'P2034') && attempt < MAX_TX_ATTEMPTS) continue;
          throw error;
        }
      }
    } catch (error) {
      if (error instanceof TransitionAbort) return failure(error.reason);
      // Deadlock/write-conflict that outlived the retry budget → typed, retryable.
      if (isPrismaError(error, 'P2034')) return failure('conflict');
      throw error;
    }
    revalidatePath(PATH, 'page');
    return success(undefined);
  } catch (error) {
    if (error instanceof AuthzError) return failure('forbidden');
    throw error;
  }
}

// Manual order creation (ADMIN): parses its own form — same guarded items
// JSON + checkoutSchema field set as the storefront checkout — then delegates
// to the SHARED createOrderCore (VISIBLE load, stock check, server-side
// pricing, promo triple-check, bounded totals, snapshot transaction +
// NEW_ORDER notification). clientId is null: the order is on behalf of a
// walk-in customer, never attached to the admin's own account.
export async function createManualOrder(
  formData: FormData
): Promise<ActionResult<{orderId: string}>> {
  try {
    await requireAdmin();
    const lines = parseOrderLines(formData.get('items'));
    if (lines === null) return failure('cartChanged');

    const parsed = checkoutSchema.safeParse({
      name: String(formData.get('name') ?? ''),
      phone: String(formData.get('phone') ?? ''),
      address: String(formData.get('address') ?? ''),
      city: String(formData.get('city') ?? ''),
      notes: String(formData.get('notes') ?? ''),
      promoCode: String(formData.get('promoCode') ?? '')
    });
    if (!parsed.success) return failure('validation', fieldErrorsFromZod(parsed.error));
    const customer = parsed.data;

    const result = await createOrderCore({
      lines,
      customer,
      promoCode: customer.promoCode,
      clientId: null
    });
    if (result.ok) revalidatePath(PATH, 'page');
    return result;
  } catch (error) {
    if (error instanceof AuthzError) return failure('forbidden');
    throw error;
  }
}

// Advisory promo validation for the manual-order builder's running totals —
// the cart-page checkPromo idiom behind requireAdmin. createManualOrder
// re-validates the code from scratch; validatePromoCode scalar-guards the
// raw client value itself.
export async function checkOrderPromo(
  code: string
): Promise<ActionResult<{code: string; percentOff: number}>> {
  try {
    await requireAdmin();
    const promo = await validatePromoCode(code);
    return promo === null ? failure('invalidPromo') : success(promo);
  } catch (error) {
    if (error instanceof AuthzError) return failure('forbidden');
    throw error;
  }
}

// checkoutSchema minus promo — the promo snapshot is frozen at creation and
// never editable (honor-the-snapshot policy above).
const orderCustomerSchema = checkoutSchema.omit({promoCode: true});

export async function updateOrderCustomer(id: string, formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    if (typeof id !== 'string' || !ID_PATTERN.test(id)) return failure('notFound');
    const existing = await prisma.order.findUnique({where: {id}, select: {archivedAt: true}});
    if (!existing) return failure('notFound');
    if (existing.archivedAt !== null) return failure('orderArchived');

    const parsed = orderCustomerSchema.safeParse({
      name: String(formData.get('name') ?? ''),
      phone: String(formData.get('phone') ?? ''),
      address: String(formData.get('address') ?? ''),
      city: String(formData.get('city') ?? ''),
      notes: String(formData.get('notes') ?? '')
    });
    if (!parsed.success) return failure('validation', fieldErrorsFromZod(parsed.error));

    await prisma.order.update({
      where: {id},
      data: {
        customerName: parsed.data.name,
        customerPhone: parsed.data.phone,
        // Order has no city column (Phase 1 schema) — the city is folded into
        // the address snapshot, exactly like placeOrder does.
        customerAddress: `${parsed.data.address}, ${parsed.data.city}`,
        notes: parsed.data.notes ? parsed.data.notes : null
      }
    });
    revalidatePath(PATH, 'page');
    return success(undefined);
  } catch (error) {
    if (error instanceof AuthzError) return failure('forbidden');
    if (isPrismaError(error, 'P2025')) return failure('notFound');
    throw error;
  }
}

export async function archiveOrder(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    if (typeof id !== 'string' || !ID_PATTERN.test(id)) return failure('notFound');
    await prisma.order.update({where: {id}, data: {archivedAt: new Date()}});
    revalidatePath(PATH, 'page');
    return success(undefined);
  } catch (error) {
    if (error instanceof AuthzError) return failure('forbidden');
    if (isPrismaError(error, 'P2025')) return failure('notFound');
    throw error;
  }
}

export async function restoreOrder(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    if (typeof id !== 'string' || !ID_PATTERN.test(id)) return failure('notFound');
    await prisma.order.update({where: {id}, data: {archivedAt: null}});
    revalidatePath(PATH, 'page');
    return success(undefined);
  } catch (error) {
    if (error instanceof AuthzError) return failure('forbidden');
    if (isPrismaError(error, 'P2025')) return failure('notFound');
    throw error;
  }
}
