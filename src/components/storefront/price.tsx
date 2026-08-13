import {cn} from '@/lib/utils';
import {effectivePriceMillimes, formatMillimes} from '@/lib/money';

type PriceProps = {
  priceMillimes: number;
  discountPct: number;
  massDiscountPct: number | null;
  currencyLabel: string;
  /**
   * 'lg' sets the figure in the display role (ExtraBold, tight leading) for
   * the product page, where the price is the page's hero data. Cards and
   * lists keep the default inline size.
   */
  size?: 'default' | 'lg';
};

// Server-compatible price display (no hooks). Shows the effective price and,
// when a discount applies, the struck-through original plus a -N% badge where
// N is the pct effectivePriceMillimes actually applied (the mass discount
// overrides the per-product pct when set).
export function Price({
  priceMillimes,
  discountPct,
  massDiscountPct,
  currencyLabel,
  size = 'default'
}: PriceProps) {
  const pct = massDiscountPct ?? discountPct;
  const discounted = pct > 0;
  const effective = effectivePriceMillimes(priceMillimes, discountPct, massDiscountPct);
  const lg = size === 'lg';

  return (
    <p className={cn('flex flex-wrap items-baseline gap-x-2 gap-y-1', lg && 'gap-x-3')}>
      <span
        className={cn(
          'tabular-nums',
          lg ? 'text-4xl leading-none font-extrabold' : 'font-semibold'
        )}
      >
        {formatMillimes(effective)} {currencyLabel}
      </span>
      {discounted && (
        <>
          <span
            className={cn(
              'text-muted-foreground line-through',
              lg ? 'text-base' : 'text-sm'
            )}
          >
            {formatMillimes(priceMillimes)} {currencyLabel}
          </span>
          <span
            dir="ltr"
            className={cn(
              'rounded-md bg-destructive/10 font-medium text-destructive',
              lg ? 'px-2 py-1 text-sm' : 'px-1.5 py-0.5 text-xs'
            )}
          >
            -{pct}%
          </span>
        </>
      )}
    </p>
  );
}
