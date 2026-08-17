// All monetary amounts in this codebase are integer millimes (1 TND = 1000 millimes).
// Amounts are non-negative.

// Upper bound for any millimes amount (2,000,000 DT) — safely under the
// Postgres Int4 max (2,147,483,647) so bounded inputs can never overflow.
export const MAX_MILLIMES = 2_000_000_000;

export function effectivePriceMillimes(
  priceMillimes: number,
  discountPct: number,
  massDiscountPct: number | null
): number {
  const pct = massDiscountPct ?? discountPct;
  return Math.round((priceMillimes * (100 - pct)) / 100);
}

// ── Wholesale ("prix de gros") ───────────────────────────────────────────────
//
// Buying enough of ONE product switches that line to a flat wholesale unit
// price. The threshold is per line, not per basket: five different items is a
// normal order, five of the same item is buying in bulk, and only the second is
// what a gros price is for.
//
// The wholesale price is ABSOLUTE (a unit price in millimes), not a percentage,
// because that is how a shop actually quotes one — "20 DT la pièce à partir de
// 5" — and it removes any question of how it would compound with discountPct.

/** Below this a "wholesale" threshold would just be the ordinary price. */
export const MIN_WHOLESALE_QTY = 2;

/**
 * The quantity at which a product switches to its wholesale price: its own
 * override when set, otherwise the shop-wide default.
 *
 * Returns Infinity for a threshold that cannot mean anything (0, 1, negative,
 * non-integer), so a misconfigured value makes wholesale simply never apply
 * rather than applying to every single unit.
 */
export function wholesaleThreshold(
  productMinQty: number | null,
  defaultMinQty: number
): number {
  const value = productMinQty ?? defaultMinQty;
  if (!Number.isInteger(value) || value < MIN_WHOLESALE_QTY) return Number.POSITIVE_INFINITY;
  return value;
}

export type UnitPriceInput = {
  priceMillimes: number;
  discountPct: number;
  massDiscountPct: number | null;
  /** null when this product has no wholesale price. */
  wholesalePriceMillimes: number | null;
  /** Per-product override; null falls back to defaultMinQty. */
  wholesaleMinQty: number | null;
  /** Shop-wide default threshold (admin parameter). */
  defaultMinQty: number;
  qty: number;
};

/**
 * What ONE unit costs on a line of `qty`. The single source of truth for
 * wholesale pricing — the storefront, the cart, the admin's manual order
 * builder and createOrderCore all resolve a price through this, so a displayed
 * price and a charged price cannot disagree.
 *
 * NEVER RETURNS MORE THAN THE RETAIL PRICE. A shop can set a gros price and
 * later run a mass discount that beats it; taking the lower of the two means
 * ordering more can never cost more per unit, which is the one outcome a
 * customer would rightly call a bug.
 */
export function unitPriceForQty(input: UnitPriceInput): number {
  const retail = effectivePriceMillimes(
    input.priceMillimes,
    input.discountPct,
    input.massDiscountPct
  );
  if (input.wholesalePriceMillimes === null) return retail;
  if (input.qty < wholesaleThreshold(input.wholesaleMinQty, input.defaultMinQty)) return retail;
  return Math.min(retail, input.wholesalePriceMillimes);
}

/** True when this line is actually being charged the wholesale price. */
export function wholesaleApplies(input: UnitPriceInput): boolean {
  if (input.wholesalePriceMillimes === null) return false;
  if (input.qty < wholesaleThreshold(input.wholesaleMinQty, input.defaultMinQty)) return false;
  // A gros price the retail price already beats is not "applied" — saying so
  // would advertise a saving the customer is not getting.
  const retail = effectivePriceMillimes(
    input.priceMillimes,
    input.discountPct,
    input.massDiscountPct
  );
  return input.wholesalePriceMillimes < retail;
}

/** Units still needed before the wholesale price kicks in; 0 once it has. */
export function unitsUntilWholesale(input: UnitPriceInput): number {
  if (input.wholesalePriceMillimes === null) return 0;
  const threshold = wholesaleThreshold(input.wholesaleMinQty, input.defaultMinQty);
  if (!Number.isFinite(threshold)) return 0;
  // Nothing to advertise if the gros price is not actually cheaper.
  const retail = effectivePriceMillimes(
    input.priceMillimes,
    input.discountPct,
    input.massDiscountPct
  );
  if (input.wholesalePriceMillimes >= retail) return 0;
  return Math.max(0, threshold - input.qty);
}

export function formatMillimes(millimes: number): string {
  const dinars = Math.trunc(millimes / 1000);
  const rest = (millimes % 1000).toString().padStart(3, '0');
  const grouped = dinars.toLocaleString('en-US').replaceAll(',', ' ');
  return `${grouped}.${rest}`;
}

export function parseDinarsToMillimes(input: string): number | null {
  const trimmed = input.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,3})?$/.test(trimmed)) return null;
  const [dinars, decimals = ''] = trimmed.split('.');
  return parseInt(dinars, 10) * 1000 + parseInt((decimals + '000').slice(0, 3), 10);
}

export function millimesToInput(millimes: number): string {
  const dinars = Math.trunc(millimes / 1000);
  const rest = (millimes % 1000).toString().padStart(3, '0');
  return `${dinars}.${rest}`;
}
