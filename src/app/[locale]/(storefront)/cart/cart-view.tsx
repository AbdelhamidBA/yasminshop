'use client';

import {useState, useTransition} from 'react';
import {useTranslations} from 'next-intl';
import {useCart} from '@/components/cart/cart-provider';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Link} from '@/i18n/navigation';
import {MAX_QTY} from '@/lib/cart';
import {computeCartTotals} from '@/lib/checkout';
import {formatMillimes} from '@/lib/money';
import {checkPromo} from '../checkout/actions';

type CartViewProps = {
  locale: string;
  deliveryCostMillimes: number;
  freeDeliveryThresholdMillimes: number;
  currencyLabel: string;
  // Reserved (plan interface): cart lines already carry the EFFECTIVE price
  // captured at add-time, so no client-side re-pricing happens here —
  // checkout re-prices every line server-side from the DB.
  massDiscountPct: number | null;
};

type AppliedPromo = {code: string; percentOff: number};

// Client cart: lines from the localStorage provider, totals via the pure
// computeCartTotals lib (same function the server action uses — display and
// server math cannot drift). All amounts shown are DISPLAY ONLY.
export function CartView({
  locale,
  deliveryCostMillimes,
  freeDeliveryThresholdMillimes,
  currencyLabel
}: CartViewProps) {
  const t = useTranslations('cart');
  const {state, hydrated, setQty, remove} = useCart();
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);
  const [promoInvalid, setPromoInvalid] = useState(false);
  const [pending, startTransition] = useTransition();

  // Server renders (and the client's first paint hydrates) nothing — the cart
  // only exists client-side, so content appears after the localStorage read.
  if (!hydrated) return null;

  if (state.items.length === 0) {
    return (
      <div className="mt-12 flex flex-col items-center gap-4 py-12 text-center">
        <p className="text-muted-foreground">{t('empty')}</p>
        <Button render={<Link href="/products" />}>{t('browse')}</Button>
      </div>
    );
  }

  const totals = computeCartTotals({
    items: state.items.map(({unitPriceMillimes, qty}) => ({unitPriceMillimes, qty})),
    promoPercentOff: appliedPromo?.percentOff ?? null,
    deliveryCostMillimes,
    freeDeliveryThresholdMillimes
  });
  const afterPromoMillimes = totals.subtotalMillimes - totals.promoDiscountMillimes;
  const remainingForFreeDelivery = freeDeliveryThresholdMillimes - afterPromoMillimes;

  const checkoutHref = appliedPromo
    ? `/checkout?promo=${encodeURIComponent(appliedPromo.code)}`
    : '/checkout';

  function applyPromo() {
    const code = promoInput.trim();
    if (code === '' || pending) return;
    startTransition(async () => {
      const result = await checkPromo(code);
      if (result.ok) {
        setAppliedPromo(result.data);
        setPromoInvalid(false);
      } else {
        setAppliedPromo(null);
        setPromoInvalid(true);
      }
    });
  }

  return (
    <div className="mt-6 flex flex-col items-start gap-8 lg:flex-row">
      {/* Lines */}
      <ul className="w-full min-w-0 flex-1 divide-y rounded-lg border bg-card">
        {state.items.map((line) => {
          const name = locale === 'ar' ? line.nameAr : line.nameFr;
          return (
            <li key={line.productId} className="flex items-start gap-4 p-4">
              <Link href={`/products/${line.slug}`} className="shrink-0">
                <img
                  src={line.imageUrl ?? '/placeholder-product.svg'}
                  alt={name}
                  className="size-20 rounded-lg border object-cover"
                />
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/products/${line.slug}`}
                  className="line-clamp-2 text-sm font-medium hover:underline"
                >
                  {name}
                </Link>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('unitPrice')}: {formatMillimes(line.unitPriceMillimes)} {currencyLabel}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <div className="flex items-center rounded-lg border">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={line.qty <= 1}
                      onClick={() => setQty(line.productId, line.qty - 1)}
                    >
                      −
                    </Button>
                    <span aria-live="polite" className="w-10 text-center text-sm tabular-nums">
                      {line.qty}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={line.qty >= MAX_QTY}
                      onClick={() => setQty(line.productId, line.qty + 1)}
                    >
                      +
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => remove(line.productId)}
                  >
                    {t('remove')}
                  </Button>
                </div>
              </div>
              <p className="text-sm font-semibold whitespace-nowrap">
                <span className="sr-only">{t('lineTotal')}: </span>
                {formatMillimes(line.unitPriceMillimes * line.qty)} {currencyLabel}
              </p>
            </li>
          );
        })}
      </ul>

      {/* Totals card — sticky on lg so it follows long carts */}
      <aside className="w-full shrink-0 lg:sticky lg:top-24 lg:w-80">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="promo-code">{t('promoLabel')}</Label>
            <div className="flex gap-2">
              <Input
                id="promo-code"
                dir="ltr"
                value={promoInput}
                onChange={(event) => setPromoInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    applyPromo();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                disabled={pending || promoInput.trim() === ''}
                onClick={applyPromo}
              >
                {t('promoApply')}
              </Button>
            </div>
            {appliedPromo !== null && (
              <p className="text-sm text-primary">
                {t('promoApplied', {code: appliedPromo.code, pct: appliedPromo.percentOff})}
              </p>
            )}
            {promoInvalid && <p className="text-sm text-destructive">{t('promoInvalid')}</p>}
          </div>

          <dl className="mt-4 flex flex-col gap-2 border-t pt-4 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">{t('subtotal')}</dt>
              <dd className="tabular-nums">
                {formatMillimes(totals.subtotalMillimes)} {currencyLabel}
              </dd>
            </div>
            {totals.promoDiscountMillimes > 0 && (
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">{t('promoDiscount')}</dt>
                <dd dir="ltr" className="tabular-nums text-primary">
                  -{formatMillimes(totals.promoDiscountMillimes)} {currencyLabel}
                </dd>
              </div>
            )}
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">{t('delivery')}</dt>
              <dd className="tabular-nums">
                {totals.deliveryCostMillimes === 0
                  ? t('deliveryFree')
                  : `${formatMillimes(totals.deliveryCostMillimes)} ${currencyLabel}`}
              </dd>
            </div>
            <div className="flex items-center justify-between border-t pt-2 text-base font-semibold">
              <dt>{t('total')}</dt>
              <dd className="tabular-nums">
                {formatMillimes(totals.totalMillimes)} {currencyLabel}
              </dd>
            </div>
          </dl>

          {remainingForFreeDelivery > 0 && (
            <p className="mt-3 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
              {t('freeDeliveryHint', {
                amount: formatMillimes(remainingForFreeDelivery),
                currency: currencyLabel
              })}
            </p>
          )}

          <Button className="mt-4 w-full" size="lg" render={<Link href={checkoutHref} />}>
            {t('checkout')}
          </Button>
        </div>
      </aside>
    </div>
  );
}
