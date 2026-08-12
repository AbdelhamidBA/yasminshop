'use client';

import {useState, useTransition} from 'react';
import {Banknote} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {toast} from 'sonner';
import {useCart} from '@/components/cart/cart-provider';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Textarea} from '@/components/ui/textarea';
import {Link, useRouter} from '@/i18n/navigation';
import {computeCartTotals} from '@/lib/checkout';
import {fieldErrorText} from '@/lib/field-error';
import {formatMillimes} from '@/lib/money';
import {placeOrder} from './actions';

export type CheckoutPrefill = {name: string; phone: string; address: string; city: string};

type CheckoutFormProps = {
  locale: string;
  deliveryCostMillimes: number;
  freeDeliveryThresholdMillimes: number;
  currencyLabel: string;
  // Reserved (plan interface): summary lines show the effective prices the
  // cart captured at add-time — the action re-prices from the DB anyway.
  massDiscountPct: number | null;
  // Server-validated (advisory) promo from ?promo=CODE; placeOrder re-checks.
  promo: {code: string; percentOff: number} | null;
  prefill: CheckoutPrefill;
};

// Checkout: guest form (prefilled for logged-in users) + client-computed
// order summary. Everything money-related shown here is DISPLAY ONLY — the
// placeOrder action ignores client prices and recomputes from the DB.
export function CheckoutForm({
  locale,
  deliveryCostMillimes,
  freeDeliveryThresholdMillimes,
  currencyLabel,
  promo,
  prefill
}: CheckoutFormProps) {
  const t = useTranslations('checkout');
  const tCart = useTranslations('cart');
  const router = useRouter();
  const {state, hydrated, clear} = useCart();
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // Set before clear() so the just-emptied cart does not flash the empty
  // state while the confirmation redirect is in flight.
  const [placed, setPlaced] = useState(false);

  // Shared localizer: maps a message-KEY through this form's errors.* namespace,
  // falling back to errors.validation — never echoes a raw zod code.
  function errorText(code: string): string {
    return fieldErrorText(code, t);
  }

  function errorLine(key: string) {
    const message = fieldErrors[key];
    if (!message) return null;
    return <p className="text-sm text-destructive">{errorText(message)}</p>;
  }

  function submit(formData: FormData) {
    if (state.items.length === 0) return;
    // Only {productId, qty} is submitted — client prices never reach the
    // server (product-form hidden-JSON idiom).
    formData.set(
      'items',
      JSON.stringify(state.items.map(({productId, qty}) => ({productId, qty})))
    );
    formData.set('promoCode', promo?.code ?? '');
    startTransition(async () => {
      const result = await placeOrder(formData);
      if (result.ok) {
        setPlaced(true);
        clear();
        router.push(`/order-confirmation/${result.data.orderId}`);
      } else {
        setFieldErrors(result.fieldErrors ?? {});
        toast.error(errorText(result.error));
      }
    });
  }

  // The cart only exists client-side: nothing to render until hydration.
  if (!hydrated) return null;

  if (state.items.length === 0 && !placed) {
    return (
      <div className="mt-12 flex flex-col items-center gap-4 py-12 text-center">
        <p className="text-muted-foreground">{tCart('empty')}</p>
        <Button render={<Link href="/products" />}>{tCart('browse')}</Button>
      </div>
    );
  }

  const totals = computeCartTotals({
    items: state.items.map(({unitPriceMillimes, qty}) => ({unitPriceMillimes, qty})),
    promoPercentOff: promo?.percentOff ?? null,
    deliveryCostMillimes,
    freeDeliveryThresholdMillimes
  });

  return (
    <div className="mt-6 flex flex-col items-start gap-8 lg:flex-row">
      {/* Form */}
      <form action={submit} className="w-full min-w-0 flex-1 rounded-lg border bg-card p-6">
        <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="name">{t('name')}</Label>
            <Input id="name" name="name" autoComplete="name" defaultValue={prefill.name} />
            {errorLine('name')}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="phone">{t('phone')}</Label>
            <Input
              id="phone"
              name="phone"
              dir="ltr"
              inputMode="tel"
              autoComplete="tel"
              defaultValue={prefill.phone}
            />
            {errorLine('phone')}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="city">{t('city')}</Label>
            <Input
              id="city"
              name="city"
              autoComplete="address-level2"
              defaultValue={prefill.city}
            />
            {errorLine('city')}
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="address">{t('address')}</Label>
            <Input
              id="address"
              name="address"
              autoComplete="street-address"
              defaultValue={prefill.address}
            />
            {errorLine('address')}
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="notes">{t('notes')}</Label>
            <Textarea id="notes" name="notes" rows={3} />
            {errorLine('notes')}
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" size="lg" className="w-full" disabled={pending}>
              {t('placeOrder')}
            </Button>
          </div>
        </fieldset>
      </form>

      {/* Summary card + pay-on-delivery notice */}
      <aside className="flex w-full shrink-0 flex-col gap-4 lg:sticky lg:top-24 lg:w-96">
        <div className="rounded-lg border bg-card p-4">
          <h2 className="text-base font-semibold">{t('summary')}</h2>
          <ul className="mt-3 flex flex-col gap-2 border-b pb-3 text-sm">
            {state.items.map((line) => {
              const name = locale === 'ar' ? line.nameAr : line.nameFr;
              return (
                <li key={line.productId} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 flex-1 truncate">
                    {name} <span className="text-muted-foreground">×{line.qty}</span>
                  </span>
                  <span className="tabular-nums whitespace-nowrap">
                    {formatMillimes(line.unitPriceMillimes * line.qty)} {currencyLabel}
                  </span>
                </li>
              );
            })}
          </ul>
          <dl className="mt-3 flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">{tCart('subtotal')}</dt>
              <dd className="tabular-nums">
                {formatMillimes(totals.subtotalMillimes)} {currencyLabel}
              </dd>
            </div>
            {promo !== null && (
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">
                  {tCart('promoDiscount')}{' '}
                  <span dir="ltr" className="text-xs">
                    ({promo.code})
                  </span>
                </dt>
                <dd dir="ltr" className="tabular-nums text-primary">
                  -{formatMillimes(totals.promoDiscountMillimes)} {currencyLabel}
                </dd>
              </div>
            )}
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">{tCart('delivery')}</dt>
              <dd className="tabular-nums">
                {totals.deliveryCostMillimes === 0
                  ? tCart('deliveryFree')
                  : `${formatMillimes(totals.deliveryCostMillimes)} ${currencyLabel}`}
              </dd>
            </div>
            <div className="flex items-center justify-between border-t pt-2 text-base font-semibold">
              <dt>{tCart('total')}</dt>
              <dd className="tabular-nums">
                {formatMillimes(totals.totalMillimes)} {currencyLabel}
              </dd>
            </div>
          </dl>
          {errorLine('promoCode')}
        </div>

        <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-4">
          <Banknote className="size-5 shrink-0 text-primary" aria-hidden="true" />
          <p className="text-sm font-medium">{t('payOnDelivery')}</p>
        </div>
      </aside>
    </div>
  );
}
