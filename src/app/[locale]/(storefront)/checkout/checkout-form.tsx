'use client';

import {useState, useTransition, type ReactNode} from 'react';
import {useTranslations} from 'next-intl';
import {toast} from 'sonner';
import {useCart} from '@/components/cart/cart-provider';
import {Eyebrow, Slip, SlipRow, Stamp} from '@/components/storefront/brand';
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
//
// Design pass: this is where hesitation peaks — a stranger's website asking a
// cash customer for their address. So the form gets real typographic structure
// (utility-face labels, three titled groups, generous spacing), the summary
// becomes the bon de livraison (Slip + dotted leaders), and the place a card
// form would put "Payment" states the truth instead: there is no online
// payment here, you pay the courier. The cachet sits directly above the submit
// button — used ONCE on this page.
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
  const tProduct = useTranslations('product');
  const router = useRouter();
  const {state, hydrated, clear} = useCart();
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // Set before clear() so the just-emptied cart does not flash the empty
  // state while the confirmation redirect is in flight.
  const [placed, setPlaced] = useState(false);
  // React 19 resets an uncontrolled <form action={...}> once the action
  // settles — including when it FAILS validation, which wiped the name, phone,
  // address and notes the customer had just typed (product-form idiom). Keep
  // the submitted text values and replay them as the new defaults; `entryKey`
  // remounts just those inputs so the new defaults take effect.
  const [entered, setEntered] = useState<Record<string, string>>({});
  const [entryKey, setEntryKey] = useState(0);
  const initial = (field: string, fallback: string | number | null | undefined) =>
    entered[field] ?? (fallback === null || fallback === undefined ? '' : String(fallback));

  // Letter-spacing breaks joined Arabic: every tracked treatment is gated.
  const isAr = locale === 'ar';

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

  // Utility-face section heading + hairline: the same rule the product page
  // uses, so the storefront reads as one document.
  function sectionHeading(label: string) {
    return (
      <div className="flex items-center gap-3">
        <h2 className="shrink-0">
          <Eyebrow tracked={!isAr}>{label}</Eyebrow>
        </h2>
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
      </div>
    );
  }

  // One field: utility-face label + roomy control + inline error. The label
  // TEXT is unchanged (the checkout locators read it) — only its face is.
  function field(name: string, label: string, control: ReactNode) {
    return (
      <div className="flex flex-col gap-2">
        <Label htmlFor={name} className="text-muted-foreground">
          <Eyebrow tracked={!isAr}>{label}</Eyebrow>
        </Label>
        {control}
        {errorLine(name)}
      </div>
    );
  }

  function submit(formData: FormData) {
    // Snapshot what was typed BEFORE any early return: React resets the form
    // as soon as this action returns, whatever the outcome, so every failure
    // path has to put the values back — not just the server-rejected one.
    const typed: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      if (typeof value === 'string') typed[key] = value;
    }
    const restoreTypedValues = () => {
      setEntered(typed);
      setEntryKey((key) => key + 1);
    };

    if (state.items.length === 0) {
      restoreTypedValues();
      return;
    }
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
        restoreTypedValues();
        toast.error(errorText(result.error));
      }
    });
  }

  // The cart only exists client-side: nothing to render until hydration.
  if (!hydrated) return null;

  if (state.items.length === 0 && !placed) {
    return (
      <div className="mt-10 flex flex-col items-center gap-6 rounded-lg border border-dashed bg-card/40 px-6 py-16 text-center">
        <p className="text-base font-semibold">{tCart('empty')}</p>
        <Button className="h-12 px-8 text-sm font-semibold" render={<Link href="/products" />}>
          {tCart('browse')}
        </Button>
      </div>
    );
  }

  const totals = computeCartTotals({
    items: state.items.map(({unitPriceMillimes, qty}) => ({unitPriceMillimes, qty})),
    promoPercentOff: promo?.percentOff ?? null,
    deliveryCostMillimes,
    freeDeliveryThresholdMillimes
  });

  const inputClass = 'h-11 bg-card';

  return (
    // Asymmetric 7/5: the form is a paper form on the cream ground, the slip
    // beside it is the white note that will travel with the parcel.
    <div className="mt-8 grid gap-8 lg:grid-cols-12 lg:gap-12">
      <form action={submit} className="lg:col-span-7">
        <fieldset disabled={pending} className="flex flex-col gap-10">
          <section>
            {sectionHeading(t('sectionContact'))}
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                {field(
                  'name',
                  t('name'),
                  <Input
                    id="name"
                    name="name"
                    autoComplete="name"
                    key={`name-${entryKey}`}
                    defaultValue={initial('name', prefill.name)}
                    aria-invalid={fieldErrors.name ? true : undefined}
                    className={inputClass}
                  />
                )}
              </div>
              {field(
                'phone',
                t('phone'),
                <Input
                  id="phone"
                  name="phone"
                  dir="ltr"
                  inputMode="tel"
                  autoComplete="tel"
                  key={`phone-${entryKey}`}
                  defaultValue={initial('phone', prefill.phone)}
                  aria-invalid={fieldErrors.phone ? true : undefined}
                  className={inputClass}
                />
              )}
              {field(
                'city',
                t('city'),
                <Input
                  id="city"
                  name="city"
                  autoComplete="address-level2"
                  key={`city-${entryKey}`}
                  defaultValue={initial('city', prefill.city)}
                  aria-invalid={fieldErrors.city ? true : undefined}
                  className={inputClass}
                />
              )}
            </div>
          </section>

          <section>
            {sectionHeading(t('sectionDelivery'))}
            <div className="mt-5 flex flex-col gap-5">
              {field(
                'address',
                t('address'),
                <Input
                  id="address"
                  name="address"
                  autoComplete="street-address"
                  key={`address-${entryKey}`}
                  defaultValue={initial('address', prefill.address)}
                  aria-invalid={fieldErrors.address ? true : undefined}
                  className={inputClass}
                />
              )}
              {field(
                'notes',
                t('notes'),
                <Textarea
                  id="notes"
                  name="notes"
                  rows={3}
                  key={`notes-${entryKey}`}
                  defaultValue={initial('notes', '')}
                  aria-invalid={fieldErrors.notes ? true : undefined}
                  className="bg-card"
                />
              )}
            </div>
          </section>

          {/* Where a card form would sit: the honest statement that this shop
              takes no money online, and the cachet that says when it does. */}
          <section>
            {sectionHeading(t('sectionPayment'))}
            <div className="mt-5 rounded-lg border border-dashed bg-card/50 p-5">
              <p className="text-base font-semibold">{t('payOnDelivery')}</p>
              <p className="mt-2 max-w-[60ch] text-sm leading-[1.75] text-muted-foreground">
                {t('codExplain')}
              </p>
              <div className="mt-5">
                <Stamp tracked={!isAr}>{tProduct('codStamp')}</Stamp>
              </div>
            </div>
          </section>

          <Button
            type="submit"
            disabled={pending}
            className="h-13 w-full text-sm font-semibold shadow-sm"
          >
            {t('placeOrder')}
          </Button>
        </fieldset>
      </form>

      <aside className="lg:col-span-5 lg:sticky lg:top-24 lg:self-start">
        <Slip>
          <div className="flex items-center gap-3">
            <h2 className="shrink-0">
              <Eyebrow tracked={!isAr}>{t('summary')}</Eyebrow>
            </h2>
            <span aria-hidden="true" className="h-px flex-1 bg-border" />
          </div>

          <ul className="mt-4 flex flex-col gap-3">
            {state.items.map((line) => {
              const name = isAr ? line.nameAr : line.nameFr;
              return (
                <li key={line.productId} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 flex-1 text-sm leading-snug">
                    {name} <span className="text-muted-foreground tabular-nums">×{line.qty}</span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold whitespace-nowrap tabular-nums">
                    {formatMillimes(line.unitPriceMillimes * line.qty)} {currencyLabel}
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="mt-4 border-t border-dotted pt-3">
            <SlipRow
              label={tCart('subtotal')}
              value={`${formatMillimes(totals.subtotalMillimes)} ${currencyLabel}`}
            />
            {promo !== null && (
              <SlipRow
                label={
                  <>
                    {tCart('promoDiscount')}{' '}
                    <span dir="ltr" className="text-xs text-muted-foreground">
                      ({promo.code})
                    </span>
                  </>
                }
                value={
                  <span dir="ltr" className="text-(--brand-brown)">
                    −{formatMillimes(totals.promoDiscountMillimes)} {currencyLabel}
                  </span>
                }
              />
            )}
            <SlipRow
              label={tCart('delivery')}
              value={
                totals.deliveryCostMillimes === 0
                  ? tCart('deliveryFree')
                  : `${formatMillimes(totals.deliveryCostMillimes)} ${currencyLabel}`
              }
            />
            <div className="mt-2 border-t border-dotted pt-2">
              <SlipRow
                label={tCart('total')}
                value={`${formatMillimes(totals.totalMillimes)} ${currencyLabel}`}
                emphasis
              />
            </div>
          </div>
          {errorLine('promoCode')}
        </Slip>
      </aside>
    </div>
  );
}
