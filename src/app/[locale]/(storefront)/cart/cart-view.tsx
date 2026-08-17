'use client';

import {useState, useTransition} from 'react';
import {Check, ShoppingBag, Trash2} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {useCart} from '@/components/cart/cart-provider';
import {Eyebrow, Slip, SlipRow} from '@/components/storefront/brand';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Link} from '@/i18n/navigation';
import {MAX_QTY, cartCount, cartLineUnitPrice} from '@/lib/cart';
import {computeCartTotals} from '@/lib/checkout';
import {formatMillimes} from '@/lib/money';
import {cn} from '@/lib/utils';
import {checkPromo} from '../checkout/actions';

type CartViewProps = {
  locale: string;
  deliveryCostMillimes: number;
  freeDeliveryThresholdMillimes: number;
  currencyLabel: string;
  // Cart lines carry the EFFECTIVE price captured at add-time, so no client-side
  // re-pricing happens here — checkout re-prices every line server-side from the
  // DB. When a global mass discount is active this prop is non-null and drives
  // the §6e "prices updated at checkout" notice (add-time prices may be stale).
  massDiscountPct: number | null;
};

type AppliedPromo = {code: string; percentOff: number};

// Client cart: lines from the localStorage provider, totals via the pure
// computeCartTotals lib (same function the server action uses — display and
// server math cannot drift). All amounts shown are DISPLAY ONLY.
//
// Design pass: the summary panel is the store's bon de livraison — a Slip whose
// promo field and dotted-leader rows belong to ONE piece of paper, so an
// applied code lands as a "Remise" line on the slip rather than as a badge
// floating beside it.
export function CartView({
  locale,
  deliveryCostMillimes,
  freeDeliveryThresholdMillimes,
  currencyLabel,
  massDiscountPct
}: CartViewProps) {
  const t = useTranslations('cart');
  const tCheckout = useTranslations('checkout');
  const tDrawer = useTranslations('cartDrawer');
  const tProduct = useTranslations('product');
  const {state, wholesaleMinQty, hydrated, setQty, remove} = useCart();
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);
  // null = no error; otherwise the message KEY to show ('promoInvalid' | 'rateLimited').
  const [promoError, setPromoError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Letter-spacing breaks joined Arabic: every tracked/uppercase treatment on
  // this surface is gated on this flag.
  const isAr = locale === 'ar';

  // Server renders (and the client's first paint hydrates) nothing — the cart
  // only exists client-side, so content appears after the localStorage read.
  if (!hydrated) return null;

  if (state.items.length === 0) {
    return (
      <div className="mt-10 flex flex-col items-center gap-6 rounded-lg border border-dashed bg-card/40 px-6 py-16 text-center">
        <span
          aria-hidden="true"
          className="flex size-16 items-center justify-center rounded-lg border border-dashed text-muted-foreground/50"
        >
          <ShoppingBag className="size-7" />
        </span>
        <p className="text-base font-semibold">{t('empty')}</p>
        <Button className="h-12 px-8 text-sm font-semibold" render={<Link href="/products" />}>
          {t('browse')}
        </Button>
      </div>
    );
  }

  const totals = computeCartTotals({
    // Wholesale is resolved per line BEFORE the totals math, so the promo and
    // the free-delivery threshold both work off the price actually charged.
    items: state.items.map((line) => ({
      unitPriceMillimes: cartLineUnitPrice(line, wholesaleMinQty),
      qty: line.qty
    })),
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
        setPromoError(null);
      } else {
        setAppliedPromo(null);
        // 'rateLimited' gets its own copy; anything else is an invalid code.
        setPromoError(result.error === 'rateLimited' ? 'rateLimited' : 'promoInvalid');
      }
    });
  }

  return (
    <>
      <Eyebrow tracked={!isAr} className="mt-3 block text-muted-foreground">
        {tDrawer('itemCount', {count: cartCount(state)})}
      </Eyebrow>

      {massDiscountPct !== null && (
        <p className="mt-6 rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm text-(--brand-brown)">
          {t('pricesUpdatedNotice')}
        </p>
      )}

      {/* Asymmetric 7/5, like the product page: the lines earn the width, the
          slip is narrow and follows the reader down a long cart. */}
      <div className="mt-8 grid gap-8 lg:grid-cols-12 lg:gap-10">
        <ul className="divide-y divide-dotted self-start rounded-lg border bg-card lg:col-span-7">
          {state.items.map((line) => {
            const name = isAr ? line.nameAr : line.nameFr;
            return (
              <li key={line.productId} className="flex items-start gap-4 p-4 sm:p-5">
                <Link href={`/products/${line.slug}`} className="shrink-0">
                  <img
                    src={line.imageUrl ?? '/placeholder-product.svg'}
                    alt={name}
                    className="size-20 rounded-lg border object-cover sm:size-24"
                  />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <Link
                      href={`/products/${line.slug}`}
                      className="line-clamp-2 leading-snug font-semibold hover:underline"
                    >
                      {name}
                    </Link>
                    {/* The line total is the figure being weighed: display
                        face, brand brown, tabular. */}
                    <p className="shrink-0 text-base font-extrabold whitespace-nowrap tabular-nums text-(--brand-brown) sm:text-lg">
                      <span className="sr-only">{t('lineTotal')}: </span>
                      {formatMillimes(cartLineUnitPrice(line, wholesaleMinQty) * line.qty)} {currencyLabel}
                    </p>
                  </div>
                  {/* Unit price only earns a line once it differs from the
                      line total — at qty 1 the two figures are the same and
                      printing both is noise. */}
                  {line.qty > 1 && (
                    <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
                      <Eyebrow tracked={!isAr} className="text-muted-foreground">
                        {t('unitPrice')}
                      </Eyebrow>
                      <span className="text-sm tabular-nums">
                        {formatMillimes(cartLineUnitPrice(line, wholesaleMinQty))} {currencyLabel} ×{line.qty}
                      </span>
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    {/* Stepper: same roomy pill as the product page. Locator
                        surfaces preserved — +/− button text and the aria-live
                        quantity span. */}
                    <div className="flex h-11 items-center rounded-lg border px-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={line.qty <= 1}
                        onClick={() => setQty(line.productId, line.qty - 1)}
                        className="rounded-lg"
                      >
                        −
                      </Button>
                      <span
                        aria-live="polite"
                        className="w-10 text-center text-base font-semibold tabular-nums"
                      >
                        {line.qty}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={line.qty >= MAX_QTY}
                        onClick={() => setQty(line.productId, line.qty + 1)}
                        className="rounded-lg"
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
                      <Trash2 />
                      {t('remove')}
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        {/* The slip: promo field and totals are ONE piece of paper, torn edge
            at the foot, with the decisive CTA below it. */}
        <aside className="lg:col-span-5 lg:sticky lg:top-24 lg:self-start">
          <Slip>
            <div className="flex items-center gap-3">
              <h2 className="shrink-0">
                <Eyebrow tracked={!isAr}>{tCheckout('summary')}</Eyebrow>
              </h2>
              <span aria-hidden="true" className="h-px flex-1 bg-border" />
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <Label htmlFor="promo-code" className="text-muted-foreground">
                <Eyebrow tracked={!isAr}>{t('promoLabel')}</Eyebrow>
              </Label>
              <div className="flex gap-2">
                <Input
                  id="promo-code"
                  dir="ltr"
                  // Promo codes are Latin in both catalogs; the uppercase
                  // affordance is still gated so no Arabic input is ever
                  // letter-spaced.
                  className={cn('h-11 flex-1 bg-background', !isAr && 'tracking-wide uppercase')}
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
                  variant="secondary"
                  className="h-11 shrink-0 px-4 font-semibold"
                  disabled={pending || promoInput.trim() === ''}
                  onClick={applyPromo}
                >
                  {t('promoApply')}
                </Button>
              </div>
              {appliedPromo !== null && (
                <p className="flex items-center gap-1.5 text-sm font-medium text-(--brand-brown)">
                  <Check className="size-4 shrink-0" aria-hidden="true" />
                  {t('promoApplied', {code: appliedPromo.code, pct: appliedPromo.percentOff})}
                </p>
              )}
              {promoError && (
                <p className="text-sm text-destructive">
                  {promoError === 'rateLimited' ? t('rateLimited') : t('promoInvalid')}
                </p>
              )}
            </div>

            <div className="mt-5 border-t border-dotted pt-3">
              <SlipRow
                label={t('subtotal')}
                value={`${formatMillimes(totals.subtotalMillimes)} ${currencyLabel}`}
              />
              {totals.promoDiscountMillimes > 0 && (
                <SlipRow
                  label={t('promoDiscount')}
                  value={
                    <span dir="ltr" className="text-(--brand-brown)">
                      −{formatMillimes(totals.promoDiscountMillimes)} {currencyLabel}
                    </span>
                  }
                />
              )}
              <SlipRow
                label={t('delivery')}
                value={
                  totals.deliveryCostMillimes === 0
                    ? t('deliveryFree')
                    : `${formatMillimes(totals.deliveryCostMillimes)} ${currencyLabel}`
                }
              />
              <div className="mt-2 border-t border-dotted pt-2">
                <SlipRow
                  label={t('total')}
                  value={`${formatMillimes(totals.totalMillimes)} ${currencyLabel}`}
                  emphasis
                />
              </div>
            </div>
          </Slip>

          {remainingForFreeDelivery > 0 && (
            <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
              {t('freeDeliveryHint', {
                amount: formatMillimes(remainingForFreeDelivery),
                currency: currencyLabel
              })}
            </p>
          )}

          <Button
            className="mt-5 h-13 w-full text-sm font-semibold shadow-sm"
            render={<Link href={checkoutHref} />}
          >
            {t('checkout')}
          </Button>
          {/* The store's one promise, stated plainly one step before the form
              asks for an address. The cachet itself is saved for checkout —
              and the wording stays clear of the summary's "Livraison" row,
              which the cart spec resolves strictly inside this aside. */}
          <p className="mt-3 text-center text-xs text-muted-foreground">
            {tProduct('codStamp')}
          </p>
        </aside>
      </div>
    </>
  );
}
