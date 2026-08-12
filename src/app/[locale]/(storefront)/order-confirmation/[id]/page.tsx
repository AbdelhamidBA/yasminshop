import {CircleCheck} from 'lucide-react';
import {notFound} from 'next/navigation';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {Eyebrow, Slip, SlipRow, Stamp} from '@/components/storefront/brand';
import {Button} from '@/components/ui/button';
import {Link} from '@/i18n/navigation';
import {prisma} from '@/lib/db';
import {formatMillimes} from '@/lib/money';
import {cn} from '@/lib/utils';
import {getParameters} from '@/server/settings';

// Same charset allowlist as the other public id-shaped inputs: order ids are
// cuids; the guard kills NUL bytes / junk before any Prisma filter.
const ORDER_ID_PATTERN = /^[a-z0-9-]{1,40}$/i;

// The three real OrderStatus stages a placed order moves through (CANCELED is
// not a stage — it is handled separately below). No dates, no ETAs: the shop
// has no delivery-time data model.
const STAGES = ['PENDING', 'CONFIRMED', 'DELIVERED'] as const;

type PageProps = {params: Promise<{locale: string; id: string}>};

// Public confirmation, addressable ONLY by the order's cuid (unguessable —
// never the sequential number). No auth on purpose: it shows what the orderer
// just entered, and guests have no session to check. Accepted per the plan.
//
// Design pass: the customer has just promised cash to a stranger, so this page
// is built as the receipt of that promise — the order number in the display
// role, a Slip carrying goods, money, recipient and the shop's cachet, and a
// "what happens next" list read from the order's REAL status.
export default async function OrderConfirmationPage({params}: PageProps) {
  const {locale, id} = await params;
  setRequestLocale(locale);
  if (!ORDER_ID_PATTERN.test(id)) notFound();

  const [t, tCart, tCheckout, tProduct, tStatus, parameters, order] = await Promise.all([
    getTranslations('confirmation'),
    getTranslations('cart'),
    getTranslations('checkout'),
    getTranslations('product'),
    // adminOrders.status is the single source for status wording.
    getTranslations('adminOrders.status'),
    getParameters(),
    prisma.order.findUnique({where: {id}, include: {items: true}})
  ]);
  if (!order) notFound();

  const isAr = locale === 'ar';
  const currencyLabel = parameters.currency;
  // h23 so a receipt time is never ambiguous (fr-TN otherwise renders 11:37 PM).
  const placedAt = new Intl.DateTimeFormat(isAr ? 'ar-TN' : 'fr-TN', {
    dateStyle: 'long',
    timeStyle: 'short',
    hourCycle: 'h23'
  }).format(order.createdAt);

  const currentIndex = STAGES.findIndex((stage) => stage === order.status);
  const stageBody: Record<(typeof STAGES)[number], string> = {
    PENDING: t('stepPending', {phone: order.customerPhone}),
    CONFIRMED: t('stepConfirmed'),
    DELIVERED: t('stepDelivered', {
      amount: formatMillimes(order.totalMillimes),
      currency: currencyLabel
    })
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
      <div className="flex flex-col items-center text-center">
        <CircleCheck className="size-10 text-(--brand-brown)" aria-hidden="true" />
        <h1 className="mt-5 text-3xl leading-[1.1] font-extrabold text-balance sm:text-4xl">
          {t('title')}
        </h1>
        {/* The docket number, in the display role — the one thing to write
            down if they call us. */}
        <p className="mt-6 rounded-lg border border-dashed px-5 py-2.5 text-xl font-extrabold tabular-nums text-(--brand-brown) sm:text-2xl">
          {t('number', {number: order.number})}
        </p>
        <Eyebrow tracked={!isAr} className="mt-3 block text-muted-foreground">
          {placedAt}
        </Eyebrow>
      </div>

      {/* The delivery note itself: goods, money, recipient, cachet. */}
      <Slip className="mt-10">
        <div className="flex items-center gap-3">
          <h2 className="shrink-0">
            <Eyebrow tracked={!isAr}>{tCheckout('summary')}</Eyebrow>
          </h2>
          <span aria-hidden="true" className="h-px flex-1 bg-border" />
        </div>

        {/* Snapshot lines: name/price captured at order time — immune to later
            catalog edits. Arabic views prefer the Arabic snapshot; the || falls
            back to the French one for items predating nameArSnapshot. */}
        <ul className="mt-4 flex flex-col gap-3">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 flex-1 text-sm leading-snug">
                {isAr ? item.nameArSnapshot || item.nameSnapshot : item.nameSnapshot}{' '}
                <span className="text-muted-foreground tabular-nums">×{item.qty}</span>
              </span>
              <span className="shrink-0 text-sm font-semibold whitespace-nowrap tabular-nums">
                {formatMillimes(item.lineTotalMillimes)} {currencyLabel}
              </span>
            </li>
          ))}
        </ul>

        {/* <dl> keeps the money block a real term/value list — and the e2e
            money gate (spec §6d) reads the total row as `dl > div`. */}
        <dl className="mt-4 border-t border-dotted pt-3">
          <SlipRow
            label={tCart('subtotal')}
            value={`${formatMillimes(order.subtotalMillimes)} ${currencyLabel}`}
          />
          {order.promoDiscountMillimes > 0 && (
            <SlipRow
              label={
                <>
                  {tCart('promoDiscount')}
                  {order.promoCode !== null && (
                    <>
                      {' '}
                      <span dir="ltr" className="text-xs text-muted-foreground">
                        ({order.promoCode})
                      </span>
                    </>
                  )}
                </>
              }
              value={
                <span dir="ltr" className="text-(--brand-brown)">
                  −{formatMillimes(order.promoDiscountMillimes)} {currencyLabel}
                </span>
              }
            />
          )}
          <SlipRow
            label={tCart('delivery')}
            value={
              order.deliveryCostMillimes === 0
                ? tCart('deliveryFree')
                : `${formatMillimes(order.deliveryCostMillimes)} ${currencyLabel}`
            }
          />
          <div className="mt-2 border-t border-dotted pt-2">
            <SlipRow
              label={tCart('total')}
              value={`${formatMillimes(order.totalMillimes)} ${currencyLabel}`}
              emphasis
            />
          </div>
        </dl>

        {/* Recipient + cachet: what the courier will read, and the promise the
            stamp carries. The Stamp is used ONCE on this page. */}
        <div className="mt-6 flex flex-wrap items-end justify-between gap-6 border-t border-dotted pt-5">
          <div className="min-w-0">
            <Eyebrow tracked={!isAr} className="block text-muted-foreground">
              {t('deliverTo')}
            </Eyebrow>
            {/* dir="auto" — a Latin address inside the RTL layout keeps its
                own reading order instead of being bidi-reshuffled. */}
            <p dir="auto" className="mt-2 font-semibold">
              {order.customerName}
            </p>
            <p dir="auto" className="text-sm text-muted-foreground">
              {order.customerAddress}
            </p>
          </div>
          <Stamp tracked={!isAr}>{tProduct('codStamp')}</Stamp>
        </div>
      </Slip>

      {/* What happens next, read from the order's real status — no invented
          dates or delivery windows. */}
      <section className="mt-14">
        <div className="flex items-center gap-3">
          <h2 className="shrink-0">
            <Eyebrow tracked={!isAr}>{t('nextTitle')}</Eyebrow>
          </h2>
          <span aria-hidden="true" className="h-px flex-1 bg-border" />
        </div>
        {order.status === 'CANCELED' ? (
          <p className="mt-6 text-sm font-semibold text-destructive">
            {tStatus('CANCELED' as never)}
          </p>
        ) : (
          <ol className="mt-6 flex flex-col gap-6">
            {STAGES.map((stage, index) => {
              const current = index === currentIndex;
              const done = index < currentIndex;
              return (
                <li
                  key={stage}
                  aria-current={current ? 'step' : undefined}
                  className="flex items-start gap-4"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'mt-1.5 size-2.5 shrink-0 rounded-full',
                      current
                        ? 'bg-(--brand-brown) ring-4 ring-(--brand-brown)/20'
                        : done
                          ? 'bg-(--brand-brown)'
                          : 'bg-border'
                    )}
                  />
                  <div className="min-w-0">
                    <p
                      className={cn(
                        'text-sm font-semibold',
                        !current && !done && 'text-muted-foreground'
                      )}
                    >
                      {tStatus(stage as never)}
                    </p>
                    <p
                      className={cn(
                        'mt-1 max-w-[62ch] text-sm leading-[1.75]',
                        current ? 'text-foreground/80' : 'text-muted-foreground'
                      )}
                    >
                      {stageBody[stage]}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <div className="mt-12 flex justify-center">
        <Button className="h-12 px-8 text-sm font-semibold" render={<Link href="/" />}>
          {t('backHome')}
        </Button>
      </div>
    </div>
  );
}
