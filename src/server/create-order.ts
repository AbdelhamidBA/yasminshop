import 'server-only';
import {getLocale} from 'next-intl/server';
import {routing} from '@/i18n/routing';
import {failure, success, type ActionResult} from '@/lib/action-result';
import {computeCartTotals} from '@/lib/checkout';
import {prisma} from '@/lib/db';
import {effectivePriceMillimes, formatMillimes, MAX_MILLIMES} from '@/lib/money';
import {validatePromoCode} from '@/server/promo';
import {sendPushToAllStaff} from '@/server/push';
import {getMassDiscountPct, getParameters} from '@/server/settings';
import {VISIBLE} from '@/server/storefront';

// Shared order-creation core (Task 4 extraction): placeOrder's step 2–8 body
// moved here VERBATIM so storefront checkout and admin manual creation can
// never drift. Callers own step 1 (form parsing — parseOrderLines for the
// items JSON, checkoutSchema for the customer fields) and the clientId
// decision (checkout: optional session user; manual: null).

const MAX_ORDER_LINES = 40;
// Same charset allowlist as the public search-hits endpoint: product ids are
// cuids; this kills NUL bytes / lone surrogates before any Prisma filter
// (Phase 2 fix-wave scalar-guard idiom).
const PRODUCT_ID_PATTERN = /^[a-z0-9-]{1,40}$/i;
const MAX_LINE_QTY = 99;

export type OrderLine = {productId: string; qty: number};

// Step 1 (items half): the cart arrives as a JSON hidden field (product-form
// idiom). Guarded parse — each entry must be {productId: non-empty guarded
// string, qty: int 1..99}; duplicate productIds are merged (summed, capped at
// 99 like the cart reducer); 1..40 lines after the merge. Any malformed
// payload → null → the caller's failure('cartChanged').
export function parseOrderLines(raw: unknown): OrderLine[] | null {
  if (typeof raw !== 'string') return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  const qtyById = new Map<string, number>();
  for (const entry of parsed) {
    if (typeof entry !== 'object' || entry === null) return null;
    const line = entry as Record<string, unknown>;
    if (typeof line.productId !== 'string' || !PRODUCT_ID_PATTERN.test(line.productId)) {
      return null;
    }
    if (
      typeof line.qty !== 'number' ||
      !Number.isInteger(line.qty) ||
      line.qty < 1 ||
      line.qty > MAX_LINE_QTY
    ) {
      return null;
    }
    qtyById.set(
      line.productId,
      Math.min((qtyById.get(line.productId) ?? 0) + line.qty, MAX_LINE_QTY)
    );
  }
  const lines = [...qtyById.entries()].map(([productId, qty]) => ({productId, qty}));
  return lines.length >= 1 && lines.length <= MAX_ORDER_LINES ? lines : null;
}

export type CreateOrderInput = {
  lines: OrderLine[];
  customer: {name: string; phone: string; address: string; city: string; notes?: string};
  promoCode?: string;
  // Checkout passes the session user (any role — a staff member placing an
  // order is harmless); manual admin creation passes null (the order is on
  // behalf of a walk-in customer, never attached to the admin's account).
  // Users are archived, never deleted, so a session id always still
  // satisfies the clientId FK.
  clientId: string | null;
};

// The phase's critical mutation. Everything is recomputed SERVER-SIDE from
// the DB — client prices never even reach this function (lines carry only
// {productId, qty}). Steps follow the placeOrder plan contract in order.
export async function createOrderCore(
  input: CreateOrderInput
): Promise<ActionResult<{orderId: string}>> {
  const {lines, customer, promoCode, clientId} = input;

  // ── Step 2: load the products WITH the VISIBLE filter; every requested id
  // must resolve (an archived product / archived category line means the
  // client's cart is stale) ──
  const products = await prisma.product.findMany({
    where: {AND: [VISIBLE, {id: {in: lines.map((line) => line.productId)}}]},
    select: {
      id: true,
      nameFr: true,
      nameAr: true,
      priceMillimes: true,
      discountPct: true,
      quantity: true
    }
  });
  const productById = new Map(products.map((product) => [product.id, product]));
  if (lines.some((line) => !productById.has(line.productId))) {
    return failure('cartChanged');
  }

  // ── Step 3: stock check — qty ≤ product.quantity per line. Binding per the
  // plan: any stock/visibility failure returns the single 'cartChanged' error;
  // the cart page tells the user to review (line prices/stock re-render
  // naturally since display is client-side). NO per-product detail. ──
  if (lines.some((line) => line.qty > productById.get(line.productId)!.quantity)) {
    return failure('cartChanged');
  }

  // ── Step 4: server-side effective pricing (mass-discount-aware). Client
  // prices are IGNORED by construction — they were never submitted. ──
  const massDiscountPct = await getMassDiscountPct();
  const pricedLines = lines.map((line) => {
    const product = productById.get(line.productId)!;
    const unitPriceMillimes = effectivePriceMillimes(
      product.priceMillimes,
      product.discountPct,
      massDiscountPct
    );
    return {
      productId: line.productId,
      qty: line.qty,
      nameSnapshot: product.nameFr,
      nameArSnapshot: product.nameAr,
      unitPriceMillimes,
      lineTotalMillimes: unitPriceMillimes * line.qty
    };
  });

  // ── Step 5: promo triple-check (archived + active + expiry) via
  // validatePromoCode when a code was provided ──
  let promo: {code: string; percentOff: number} | null = null;
  if (promoCode) {
    promo = await validatePromoCode(promoCode);
    if (promo === null) return failure('validation', {promoCode: 'invalidPromo'});
  }

  // ── Step 6: totals via the pure, unit-tested computeCartTotals; absurd
  // totals beyond MAX_MILLIMES can only come from a tampered cart ──
  const parameters = await getParameters();
  const totals = computeCartTotals({
    items: pricedLines.map(({unitPriceMillimes, qty}) => ({unitPriceMillimes, qty})),
    promoPercentOff: promo?.percentOff ?? null,
    deliveryCostMillimes: parameters.deliveryCostMillimes,
    freeDeliveryThresholdMillimes: parameters.freeDeliveryThresholdMillimes
  });
  // Bound guards come as a PAIR: the total check alone is insufficient — a
  // percentage promo shrinks the total, so subtotals up to ~2.22e9 could pass
  // it while still overflowing Int4 (2.147e9) in the subtotalMillimes write.
  // Bounding the subtotal also bounds every lineTotal and promoDiscount,
  // since each is ≤ subtotal.
  if (totals.subtotalMillimes > MAX_MILLIMES) return failure('cartChanged');
  if (totals.totalMillimes > MAX_MILLIMES) return failure('cartChanged');

  // ── Step 7 (clientId) is the caller's — see CreateOrderInput. ──

  // ── Step 8: ONE transaction — PENDING order + snapshot items + NEW_ORDER
  // notification. NO stock decrement here: stock is taken when the admin
  // CONFIRMS the order (Phase 4). ──
  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        status: 'PENDING',
        clientId,
        customerName: customer.name,
        customerPhone: customer.phone,
        // Order has no city column (Phase 1 schema) — the city is folded into
        // the address snapshot.
        customerAddress: `${customer.address}, ${customer.city}`,
        notes: customer.notes ? customer.notes : null,
        promoCode: promo?.code ?? null,
        subtotalMillimes: totals.subtotalMillimes,
        promoDiscountMillimes: totals.promoDiscountMillimes,
        deliveryCostMillimes: totals.deliveryCostMillimes,
        totalMillimes: totals.totalMillimes,
        items: {
          createMany: {
            data: pricedLines.map(
              ({
                productId,
                qty,
                nameSnapshot,
                nameArSnapshot,
                unitPriceMillimes,
                lineTotalMillimes
              }) => ({
                productId,
                qty,
                nameSnapshot,
                nameArSnapshot,
                unitPriceMillimes,
                lineTotalMillimes
              })
            )
          }
        }
      }
    });
    await tx.notification.create({
      data: {
        type: 'NEW_ORDER',
        payload: {
          orderId: created.id,
          number: created.number,
          totalMillimes: created.totalMillimes
        }
      }
    });
    return created;
  });

  // ── Step 8b: best-effort staff push alert (Task 5). The $transaction has
  // already committed, so this runs AFTER the order + NEW_ORDER notification are
  // durable. Fire-and-forget (never awaited) and wrapped: a push failure — bad
  // VAPID config, dead subscriptions, web-push throwing — must NEVER block or
  // fail order creation. The in-app bell is the reliable channel. web-push stays
  // in this server-only module and never enters a client bundle. ──
  let locale: string = routing.defaultLocale;
  try {
    locale = await getLocale();
  } catch {
    // Outside an intl request scope — fall back to the default-locale prefix;
    // the admin order route renders under any valid locale.
  }
  void sendPushToAllStaff({
    title: `Nouvelle commande #${order.number}`,
    body: `${formatMillimes(order.totalMillimes)} ${parameters.currency}`,
    url: `/${locale}/admin/orders/${order.id}`
  }).catch(() => {});

  // ── Step 9: the public confirmation URL uses the unguessable cuid id,
  // never the sequential number ──
  return success({orderId: order.id});
}
