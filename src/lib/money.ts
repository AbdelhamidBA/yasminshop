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
