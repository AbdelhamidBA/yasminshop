'use server';

import {auth} from '@/auth';
import {failure, fieldErrorsFromZod, success, type ActionResult} from '@/lib/action-result';
import {computeCartTotals} from '@/lib/checkout';
import {prisma} from '@/lib/db';
import {effectivePriceMillimes, MAX_MILLIMES} from '@/lib/money';
import {checkoutSchema} from '@/lib/schemas/checkout';
import {validatePromoCode} from '@/server/promo';
import {getMassDiscountPct, getParameters} from '@/server/settings';
import {VISIBLE} from '@/server/storefront';

// Cart pages call this to validate a promo before checkout; the displayed
// percentOff is advisory — placeOrder re-validates the code from scratch.
// validatePromoCode scalar-guards the raw client value itself.
export async function checkPromo(
  code: string
): Promise<ActionResult<{code: string; percentOff: number}>> {
  const promo = await validatePromoCode(code);
  return promo === null ? failure('invalidPromo') : success(promo);
}

const MAX_ORDER_LINES = 40;
// Same charset allowlist as the public search-hits endpoint: product ids are
// cuids; this kills NUL bytes / lone surrogates before any Prisma filter
// (Phase 2 fix-wave scalar-guard idiom).
const PRODUCT_ID_PATTERN = /^[a-z0-9-]{1,40}$/i;
const MAX_LINE_QTY = 99;

type OrderLine = {productId: string; qty: number};

// placeOrder step 1 (items half): the cart arrives as a JSON hidden field
// (product-form idiom). Guarded parse — each entry must be
// {productId: non-empty guarded string, qty: int 1..99}; duplicate productIds
// are merged (summed, capped at 99 like the cart reducer); 1..40 lines after
// the merge. Any malformed payload → null → failure('cartChanged').
function parseItems(raw: unknown): OrderLine[] | null {
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

// The phase's critical action. Everything is recomputed SERVER-SIDE from the
// DB — client prices never even reach this function (the items field carries
// only {productId, qty}). Steps follow the plan contract in order.
export async function placeOrder(formData: FormData): Promise<ActionResult<{orderId: string}>> {
  // ── Step 1: guarded items JSON + customer fields via checkoutSchema ──
  const lines = parseItems(formData.get('items'));
  if (lines === null) return failure('cartChanged');

  const parsedCustomer = checkoutSchema.safeParse({
    name: String(formData.get('name') ?? ''),
    phone: String(formData.get('phone') ?? ''),
    address: String(formData.get('address') ?? ''),
    city: String(formData.get('city') ?? ''),
    notes: String(formData.get('notes') ?? ''),
    promoCode: String(formData.get('promoCode') ?? '')
  });
  if (!parsedCustomer.success) {
    return failure('validation', fieldErrorsFromZod(parsedCustomer.error));
  }
  const customer = parsedCustomer.data;

  // ── Step 2: load the products WITH the VISIBLE filter; every requested id
  // must resolve (an archived product / archived category line means the
  // client's cart is stale) ──
  const products = await prisma.product.findMany({
    where: {AND: [VISIBLE, {id: {in: lines.map((line) => line.productId)}}]},
    select: {id: true, nameFr: true, priceMillimes: true, discountPct: true, quantity: true}
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
      unitPriceMillimes,
      lineTotalMillimes: unitPriceMillimes * line.qty
    };
  });

  // ── Step 5: promo triple-check (archived + active + expiry) via
  // validatePromoCode when a code was provided ──
  let promo: {code: string; percentOff: number} | null = null;
  if (customer.promoCode) {
    promo = await validatePromoCode(customer.promoCode);
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

  // ── Step 7: optional session — any role may order (a staff member placing
  // an order is harmless). Users are archived, never deleted, so a session id
  // always still satisfies the clientId FK. Empty string guarded to null. ──
  const session = await auth();
  const clientId = session?.user?.id ? session.user.id : null;

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
              ({productId, qty, nameSnapshot, unitPriceMillimes, lineTotalMillimes}) => ({
                productId,
                qty,
                nameSnapshot,
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

  // ── Step 9: the public confirmation URL uses the unguessable cuid id,
  // never the sequential number ──
  return success({orderId: order.id});
}
