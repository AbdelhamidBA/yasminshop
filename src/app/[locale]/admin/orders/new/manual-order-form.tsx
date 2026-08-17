'use client';

import {useEffect, useId, useRef, useState, useTransition} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {toast} from 'sonner';
import {
  adminControl, adminPrimaryAction, adminTextarea, Field, FormSection, Panel
} from '@/components/admin/form';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Textarea} from '@/components/ui/textarea';
import {useRouter} from '@/i18n/navigation';
import {MAX_QTY} from '@/lib/cart';
import {computeCartTotals} from '@/lib/checkout';
import {fieldErrorText} from '@/lib/field-error';
import {effectivePriceMillimes, formatMillimes, unitPriceForQty} from '@/lib/money';
import {cn} from '@/lib/utils';
import {checkOrderPromo, createManualOrder} from '../actions';

// Contract of GET /api/search-suggestions (storefront header search box).
// Storefront-visible products only — correct here per the plan: an admin can
// only add SELLABLE products to a manual order, and createOrderCore re-checks
// visibility + stock server-side anyway.
type Suggestion = {
  id: string;
  slug: string;
  nameFr: string;
  nameAr: string;
  priceMillimes: number;
  discountPct: number;
  wholesalePriceMillimes: number | null;
  wholesaleMinQty: number | null;
  imageUrl: string | null;
};

type OrderLineDraft = {
  productId: string;
  nameFr: string;
  nameAr: string;
  // Kept so the line can REPRICE as the admin changes the quantity: the same
  // wholesale rule the action will apply when it creates the order.
  priceMillimes: number;
  discountPct: number;
  wholesalePriceMillimes: number | null;
  wholesaleMinQty: number | null;
  // Effective price captured at pick-time for DISPLAY ONLY — the action
  // re-prices every line from the DB (only {productId, qty} is submitted).
  unitPriceMillimes: number;
  qty: number;
};

type ManualOrderFormProps = {
  deliveryCostMillimes: number;
  freeDeliveryThresholdMillimes: number;
  currencyLabel: string;
  massDiscountPct: number | null;
  /** Shop-wide bulk threshold, for lines whose product does not override it. */
  wholesaleMinQty: number;
};

const DEBOUNCE_MS = 250;
// Mirror of the endpoint's threshold: shorter queries return no suggestions.
const MIN_QUERY_LENGTH = 2;

// Manual order builder (ADMIN): product line builder fed by the storefront
// suggestions endpoint, checkout customer field set, optional advisory promo,
// running totals via the same pure computeCartTotals the server uses. Submit
// calls createManualOrder → shared createOrderCore.
export function ManualOrderForm({
  deliveryCostMillimes,
  freeDeliveryThresholdMillimes,
  currencyLabel,
  massDiscountPct,
  wholesaleMinQty
}: ManualOrderFormProps) {
  const t = useTranslations('adminOrders');
  const locale = useLocale();
  const router = useRouter();
  const id = useId();
  const listboxId = `${id}-listbox`;

  const [lines, setLines] = useState<OrderLineDraft[]>([]);

  // What createOrderCore will actually charge for this line at its current
  // quantity. Computed here rather than frozen at pick-time because the
  // wholesale price depends on the qty the admin is still editing — without
  // it the builder's total would disagree with the order it creates.
  const linePrice = (line: OrderLineDraft) =>
    unitPriceForQty({
      priceMillimes: line.priceMillimes,
      discountPct: line.discountPct,
      massDiscountPct,
      wholesalePriceMillimes: line.wholesalePriceMillimes,
      wholesaleMinQty: line.wholesaleMinQty,
      defaultMinQty: wholesaleMinQty,
      qty: line.qty
    });
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  // Focus tracked in a ref so a late fetch response never reopens the panel
  // after the input blurred (search-box idiom, simplified: selecting clears
  // the query, which aborts any in-flight fetch via the effect cleanup).
  const focusedRef = useRef(false);

  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{code: string; percentOff: number} | null>(
    null
  );
  const [promoInvalid, setPromoInvalid] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const [promoPending, startPromoTransition] = useTransition();
  // React 19 resets an uncontrolled <form action={...}> once the action
  // settles — including when it FAILS validation, which wiped the customer
  // fields that had just been typed. Replay the submitted values as the new
  // defaults; `entryKey` remounts just those inputs (product-form idiom). The
  // line list, the search box and the promo box are React state and already
  // survive.
  const [entered, setEntered] = useState<Record<string, string>>({});
  const [entryKey, setEntryKey] = useState(0);
  const initial = (field: string) => entered[field] ?? '';

  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_QUERY_LENGTH) {
      setSuggestions(null);
      setActiveIndex(-1);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search-suggestions?q=${encodeURIComponent(q)}`, {
          signal: controller.signal
        });
        if (!response.ok) {
          setSuggestions(null);
          setActiveIndex(-1);
          return;
        }
        const data: {suggestions?: Suggestion[]} = await response.json();
        setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
        setActiveIndex(-1);
        if (focusedRef.current) setOpen(true);
      } catch {
        if (!controller.signal.aborted) {
          setSuggestions(null);
          setActiveIndex(-1);
        }
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

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

  // Adds (or merges into) a line — the cart-reducer merge semantics: summed,
  // capped at MAX_QTY. NO /api/search-hits post here: admin picks must not
  // skew the storefront's most-searched popularity metric.
  function addLine(suggestion: Suggestion) {
    setLines((prev) => {
      const existing = prev.find((line) => line.productId === suggestion.id);
      if (existing) {
        return prev.map((line) =>
          line.productId === suggestion.id
            ? {...line, qty: Math.min(line.qty + 1, MAX_QTY)}
            : line
        );
      }
      return [
        ...prev,
        {
          productId: suggestion.id,
          nameFr: suggestion.nameFr,
          nameAr: suggestion.nameAr,
          priceMillimes: suggestion.priceMillimes,
          discountPct: suggestion.discountPct,
          wholesalePriceMillimes: suggestion.wholesalePriceMillimes,
          wholesaleMinQty: suggestion.wholesaleMinQty,
          unitPriceMillimes: effectivePriceMillimes(
            suggestion.priceMillimes,
            suggestion.discountPct,
            massDiscountPct
          ),
          qty: 1
        }
      ];
    });
    // Clearing the query aborts any in-flight fetch (effect cleanup) and
    // closes the panel — no stale reopen possible.
    setQuery('');
    setSuggestions(null);
    setActiveIndex(-1);
    setOpen(false);
  }

  function setQty(productId: string, qty: number) {
    if (qty < 1 || qty > MAX_QTY) return;
    setLines((prev) =>
      prev.map((line) => (line.productId === productId ? {...line, qty} : line))
    );
  }

  function removeLine(productId: string) {
    setLines((prev) => prev.filter((line) => line.productId !== productId));
  }

  function onSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!suggestions || suggestions.length === 0) return;
      event.preventDefault();
      setOpen(true);
      const count = suggestions.length;
      setActiveIndex((prev) =>
        prev === -1
          ? event.key === 'ArrowDown'
            ? 0
            : count - 1
          : (prev + (event.key === 'ArrowDown' ? 1 : -1) + count) % count
      );
      return;
    }
    if (event.key === 'Enter') {
      // The search input lives INSIDE the form: Enter must never submit it.
      event.preventDefault();
      if (open && suggestions && activeIndex >= 0 && activeIndex < suggestions.length) {
        addLine(suggestions[activeIndex]);
      }
    }
  }

  function applyPromo() {
    const code = promoInput.trim();
    if (code === '' || promoPending) return;
    startPromoTransition(async () => {
      const result = await checkOrderPromo(code);
      if (result.ok) {
        setAppliedPromo(result.data);
        setPromoInvalid(false);
      } else {
        setAppliedPromo(null);
        setPromoInvalid(true);
      }
    });
  }

  function submit(formData: FormData) {
    // Snapshot what was typed BEFORE the early return below: React resets the
    // form as soon as this action returns, whatever the outcome.
    const typed: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      if (typeof value === 'string') typed[key] = value;
    }
    const restoreTypedValues = () => {
      setEntered(typed);
      setEntryKey((key) => key + 1);
    };

    if (lines.length === 0) {
      restoreTypedValues();
      return;
    }
    // Only {productId, qty} is submitted — client prices never reach the
    // server (checkout hidden-JSON idiom).
    formData.set('items', JSON.stringify(lines.map(({productId, qty}) => ({productId, qty}))));
    formData.set('promoCode', appliedPromo?.code ?? '');
    startTransition(async () => {
      const result = await createManualOrder(formData);
      if (result.ok) {
        // createOrderCore writes every new order as PENDING; stock only moves
        // on the PENDING → CONFIRMED transition (lib/orders stockDelta).
        toast.success(t('new.created'), {description: t('new.createdDescription')});
        router.push(`/admin/orders/${result.data.orderId}`);
      } else {
        setFieldErrors(result.fieldErrors ?? {});
        if (result.fieldErrors?.promoCode) setPromoInvalid(true);
        restoreTypedValues();
        toast.error(errorText(result.error));
      }
    });
  }

  const totals = computeCartTotals({
    items: lines.map((line) => ({unitPriceMillimes: linePrice(line), qty: line.qty})),
    promoPercentOff: appliedPromo?.percentOff ?? null,
    deliveryCostMillimes,
    freeDeliveryThresholdMillimes
  });

  const panelOpen = open && suggestions !== null && query.trim().length >= MIN_QUERY_LENGTH;

  return (
    <form action={submit} className="flex flex-col items-start gap-6 lg:flex-row">
      <div className="flex w-full min-w-0 flex-1 flex-col gap-6">
        {/* Line builder */}
        <Panel title={t('itemsCard')} bodyClassName="flex flex-col gap-4">
          <div className="relative">
            <Label htmlFor={`${id}-search`} className="sr-only">
              {t('new.searchLabel')}
            </Label>
            <Input
              id={`${id}-search`}
              value={query}
              className={adminControl}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onSearchKeyDown}
              onFocus={() => {
                focusedRef.current = true;
                if (suggestions !== null) setOpen(true);
              }}
              onBlur={() => {
                focusedRef.current = false;
                setOpen(false);
              }}
              placeholder={t('new.searchPlaceholder')}
              role="combobox"
              aria-label={t('new.searchLabel')}
              aria-autocomplete="list"
              aria-expanded={panelOpen}
              aria-controls={listboxId}
              aria-activedescendant={
                panelOpen && activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined
              }
              autoComplete="off"
            />
            {panelOpen && (
              <div
                // Keep clicks on the panel from blurring the input before the
                // option's onClick fires (blur closes the panel).
                onMouseDown={(event) => event.preventDefault()}
                className="shadow-float absolute start-0 end-0 top-full z-50 mt-2 overflow-hidden rounded-xl bg-popover p-1 text-popover-foreground"
              >
                <ul role="listbox" id={listboxId} aria-label={t('new.searchLabel')}>
                  {suggestions.length > 0 ? (
                    suggestions.map((suggestion, index) => (
                      <li
                        key={suggestion.id}
                        id={`${id}-option-${index}`}
                        role="option"
                        aria-selected={index === activeIndex}
                        onClick={() => addLine(suggestion)}
                        onMouseEnter={() => setActiveIndex(index)}
                        className={cn(
                          'flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2',
                          index === activeIndex && 'bg-(--admin-neutral-soft)'
                        )}
                      >
                        <img
                          src={suggestion.imageUrl ?? '/placeholder-product.svg'}
                          alt=""
                          loading="lazy"
                          className="size-10 shrink-0 rounded-lg bg-(--admin-neutral-soft) object-cover"
                        />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {locale === 'ar' ? suggestion.nameAr : suggestion.nameFr}
                        </span>
                        <span className="shrink-0 text-sm font-bold tabular-nums">
                          {formatMillimes(
                            effectivePriceMillimes(
                              suggestion.priceMillimes,
                              suggestion.discountPct,
                              massDiscountPct
                            )
                          )}{' '}
                          {currencyLabel}
                        </span>
                      </li>
                    ))
                  ) : (
                    <li
                      id={`${id}-option-empty`}
                      role="option"
                      aria-disabled="true"
                      aria-selected={false}
                      className="px-2 py-3 text-sm text-muted-foreground"
                    >
                      {t('new.noResults')}
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>

          {lines.length === 0 ? (
            <p className="rounded-xl bg-(--admin-neutral-soft) px-4 py-6 text-center text-sm text-muted-foreground">
              {t('new.empty')}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {lines.map((line) => {
                const name = locale === 'ar' ? line.nameAr : line.nameFr;
                return (
                  <li
                    key={line.productId}
                    className="flex flex-wrap items-center gap-3 rounded-xl bg-(--admin-neutral-soft) p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t('unitPrice')}: {formatMillimes(linePrice(line))} {currencyLabel}
                      </p>
                    </div>
                    <div className="flex items-center rounded-lg bg-card">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={t('new.decrease')}
                        disabled={line.qty <= 1}
                        onClick={() => setQty(line.productId, line.qty - 1)}
                      >
                        −
                      </Button>
                      <span
                        aria-live="polite"
                        className="w-9 text-center text-sm font-semibold tabular-nums"
                      >
                        {line.qty}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={t('new.increase')}
                        disabled={line.qty >= MAX_QTY}
                        onClick={() => setQty(line.productId, line.qty + 1)}
                      >
                        +
                      </Button>
                    </div>
                    <p className="w-28 text-end text-sm font-bold tabular-nums whitespace-nowrap">
                      <span className="sr-only">{t('lineTotal')}: </span>
                      {formatMillimes(linePrice(line) * line.qty)} {currencyLabel}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => removeLine(line.productId)}
                    >
                      {t('new.remove')}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        {/* Customer fields — the checkout field set */}
        <fieldset disabled={pending} className="contents">
          <FormSection title={t('customerCard')}>
            <Field
              label={t('name')}
              htmlFor={`${id}-name`}
              error={errorLine('name')}
              className="sm:col-span-2"
            >
              <Input
                id={`${id}-name`}
                name="name"
                className={adminControl}
                autoComplete="off"
                key={`name-${entryKey}`}
                defaultValue={initial('name')}
              />
            </Field>
            <Field label={t('phone')} htmlFor={`${id}-phone`} error={errorLine('phone')}>
              <Input
                id={`${id}-phone`}
                name="phone"
                dir="ltr"
                inputMode="tel"
                className={adminControl}
                autoComplete="off"
                key={`phone-${entryKey}`}
                defaultValue={initial('phone')}
              />
            </Field>
            <Field label={t('city')} htmlFor={`${id}-city`} error={errorLine('city')}>
              <Input
                id={`${id}-city`}
                name="city"
                className={adminControl}
                autoComplete="off"
                key={`city-${entryKey}`}
                defaultValue={initial('city')}
              />
            </Field>
            <Field
              label={t('address')}
              htmlFor={`${id}-address`}
              error={errorLine('address')}
              className="sm:col-span-2"
            >
              <Input
                id={`${id}-address`}
                name="address"
                className={adminControl}
                autoComplete="off"
                key={`address-${entryKey}`}
                defaultValue={initial('address')}
              />
            </Field>
            <Field
              label={t('notes')}
              htmlFor={`${id}-notes`}
              error={errorLine('notes')}
              className="sm:col-span-2"
            >
              <Textarea
                id={`${id}-notes`}
                name="notes"
                rows={3}
                className={adminTextarea}
                key={`notes-${entryKey}`}
                defaultValue={initial('notes')}
              />
            </Field>
          </FormSection>
        </fieldset>
      </div>

      {/* Promo + running totals + submit */}
      <aside className="w-full shrink-0 lg:sticky lg:top-24 lg:w-80">
        <Panel bodyClassName="flex flex-col gap-5">
          <Field label={t('new.promoLabel')} htmlFor={`${id}-promo`}>
            <div className="flex gap-2">
              <Input
                id={`${id}-promo`}
                dir="ltr"
                className={adminControl}
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
                variant="ghost"
                className="h-11 shrink-0 bg-(--admin-neutral-soft) px-4"
                disabled={promoPending || promoInput.trim() === ''}
                onClick={applyPromo}
              >
                {t('new.promoApply')}
              </Button>
            </div>
            {appliedPromo !== null && (
              <p className="text-sm font-medium text-(--admin-success)">
                {t('new.promoApplied', {code: appliedPromo.code, pct: appliedPromo.percentOff})}
              </p>
            )}
            {promoInvalid && <p className="text-sm text-destructive">{errorText('invalidPromo')}</p>}
          </Field>

          <dl className="flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">{t('subtotal')}</dt>
              <dd className="font-semibold tabular-nums">
                {formatMillimes(totals.subtotalMillimes)} {currencyLabel}
              </dd>
            </div>
            {totals.promoDiscountMillimes > 0 && (
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">{t('promoDiscount')}</dt>
                <dd dir="ltr" className="font-semibold tabular-nums text-(--admin-success)">
                  -{formatMillimes(totals.promoDiscountMillimes)} {currencyLabel}
                </dd>
              </div>
            )}
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">{t('delivery')}</dt>
              <dd className="font-semibold tabular-nums">
                {totals.deliveryCostMillimes === 0
                  ? t('deliveryFree')
                  : `${formatMillimes(totals.deliveryCostMillimes)} ${currencyLabel}`}
              </dd>
            </div>
            <div className="flex items-center justify-between border-t pt-3 text-base">
              <dt className="font-semibold">{t('totalLabel')}</dt>
              <dd className="text-lg font-bold tabular-nums">
                {formatMillimes(totals.totalMillimes)} {currencyLabel}
              </dd>
            </div>
          </dl>

          <Button
            type="submit"
            className={`w-full ${adminPrimaryAction}`}
            disabled={pending || lines.length === 0}
          >
            {t('new.submit')}
          </Button>
        </Panel>
      </aside>
    </form>
  );
}
