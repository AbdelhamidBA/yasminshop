import {effectivePriceMillimes, formatMillimes} from '@/lib/money';

type PriceProps = {
  priceMillimes: number;
  discountPct: number;
  massDiscountPct: number | null;
  currencyLabel: string;
};

// Server-compatible price display (no hooks). Shows the effective price and,
// when a discount applies, the struck-through original plus a -N% badge where
// N is the pct effectivePriceMillimes actually applied (the mass discount
// overrides the per-product pct when set).
export function Price({
  priceMillimes,
  discountPct,
  massDiscountPct,
  currencyLabel
}: PriceProps) {
  const pct = massDiscountPct ?? discountPct;
  const discounted = pct > 0;
  const effective = effectivePriceMillimes(priceMillimes, discountPct, massDiscountPct);

  return (
    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className="font-semibold">
        {formatMillimes(effective)} {currencyLabel}
      </span>
      {discounted && (
        <>
          <span className="text-sm text-muted-foreground line-through">
            {formatMillimes(priceMillimes)} {currencyLabel}
          </span>
          <span
            dir="ltr"
            className="rounded-md bg-destructive/10 px-1.5 py-0.5 text-xs font-medium text-destructive"
          >
            -{pct}%
          </span>
        </>
      )}
    </p>
  );
}
