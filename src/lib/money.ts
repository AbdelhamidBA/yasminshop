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
