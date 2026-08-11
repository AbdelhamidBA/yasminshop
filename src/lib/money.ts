// All monetary amounts in this codebase are integer millimes (1 TND = 1000 millimes).
// Amounts are non-negative.

export function effectivePriceMillimes(
  priceMillimes: number,
  discountPct: number,
  massDiscountPct: number | null
): number {
  const pct = massDiscountPct ?? discountPct;
  return Math.round((priceMillimes * (100 - pct)) / 100);
}

export function formatMillimes(millimes: number): string {
  const dinars = Math.trunc(millimes / 1000);
  const rest = (millimes % 1000).toString().padStart(3, '0');
  const grouped = dinars.toLocaleString('en-US').replaceAll(',', ' ');
  return `${grouped}.${rest}`;
}
