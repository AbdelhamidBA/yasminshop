'use server';

import {auth} from '@/auth';
import {failure, fieldErrorsFromZod, success, type ActionResult} from '@/lib/action-result';
import {checkoutSchema} from '@/lib/schemas/checkout';
import {createOrderCore, parseOrderLines} from '@/server/create-order';
import {validatePromoCode} from '@/server/promo';

// Cart pages call this to validate a promo before checkout; the displayed
// percentOff is advisory — placeOrder re-validates the code from scratch.
// validatePromoCode scalar-guards the raw client value itself.
export async function checkPromo(
  code: string
): Promise<ActionResult<{code: string; percentOff: number}>> {
  const promo = await validatePromoCode(code);
  return promo === null ? failure('invalidPromo') : success(promo);
}

// The phase's critical action, now parse-then-delegate (Task 4 extraction):
// step 1 (guarded form parsing) and the optional-session clientId stay here;
// steps 2–9 — VISIBLE load, stock check, server-side pricing, promo
// triple-check, bounded totals, snapshot transaction — live in the shared
// createOrderCore, which admin manual creation reuses verbatim.
export async function placeOrder(formData: FormData): Promise<ActionResult<{orderId: string}>> {
  // ── Step 1: guarded items JSON + customer fields via checkoutSchema ──
  const lines = parseOrderLines(formData.get('items'));
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

  // ── Step 7 input: optional session — any role may order (a staff member
  // placing an order is harmless). Users are archived, never deleted, so a
  // session id always still satisfies the clientId FK. Empty string guarded
  // to null. ──
  const session = await auth();
  const clientId = session?.user?.id ? session.user.id : null;

  // ── Steps 2–9: the shared core recomputes everything server-side from the
  // DB and returns the unguessable cuid orderId. ──
  return createOrderCore({lines, customer, promoCode: customer.promoCode, clientId});
}
