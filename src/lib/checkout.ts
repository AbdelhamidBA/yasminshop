// Checkout totals math (spec §6c). All amounts are integer millimes.
// Formula: subtotal = Σ(effectiveUnitPrice × qty); promoDiscount = round(subtotal × pct/100);
// afterPromo = subtotal − promoDiscount; delivery is free iff afterPromo ≥ threshold
// (the promo applies BEFORE the threshold test); total = afterPromo + deliveryCost.

export type CartTotalsInput = {
  items: Array<{unitPriceMillimes: number; qty: number}>;
  promoPercentOff: number | null;
  deliveryCostMillimes: number;
  freeDeliveryThresholdMillimes: number;
};

export type CartTotals = {
  subtotalMillimes: number;
  promoDiscountMillimes: number;
  deliveryCostMillimes: number;
  totalMillimes: number;
};

export function computeCartTotals(input: CartTotalsInput): CartTotals {
  if (input.items.length === 0) {
    return {subtotalMillimes: 0, promoDiscountMillimes: 0, deliveryCostMillimes: 0, totalMillimes: 0};
  }
  const subtotalMillimes = input.items.reduce(
    (sum, item) => sum + item.unitPriceMillimes * item.qty,
    0
  );
  const promoDiscountMillimes =
    input.promoPercentOff === null
      ? 0
      : Math.round((subtotalMillimes * input.promoPercentOff) / 100);
  const afterPromoMillimes = subtotalMillimes - promoDiscountMillimes;
  const deliveryCostMillimes =
    afterPromoMillimes >= input.freeDeliveryThresholdMillimes ? 0 : input.deliveryCostMillimes;
  return {
    subtotalMillimes,
    promoDiscountMillimes,
    deliveryCostMillimes,
    totalMillimes: afterPromoMillimes + deliveryCostMillimes
  };
}
