import {CircleCheck} from 'lucide-react';
import {notFound} from 'next/navigation';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {Button} from '@/components/ui/button';
import {Link} from '@/i18n/navigation';
import {prisma} from '@/lib/db';
import {formatMillimes} from '@/lib/money';
import {getParameters} from '@/server/settings';

// Same charset allowlist as the other public id-shaped inputs: order ids are
// cuids; the guard kills NUL bytes / junk before any Prisma filter.
const ORDER_ID_PATTERN = /^[a-z0-9-]{1,40}$/i;

type PageProps = {params: Promise<{locale: string; id: string}>};

// Public confirmation, addressable ONLY by the order's cuid (unguessable —
// never the sequential number). No auth on purpose: it shows what the orderer
// just entered, and guests have no session to check. Accepted per the plan.
export default async function OrderConfirmationPage({params}: PageProps) {
  const {locale, id} = await params;
  setRequestLocale(locale);
  if (!ORDER_ID_PATTERN.test(id)) notFound();

  const [t, tCart, parameters, order] = await Promise.all([
    getTranslations('confirmation'),
    getTranslations('cart'),
    getParameters(),
    prisma.order.findUnique({where: {id}, include: {items: true}})
  ]);
  if (!order) notFound();

  const currencyLabel = parameters.currency;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12">
      <div className="flex flex-col items-center text-center">
        <CircleCheck className="size-12 text-primary" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-bold">{t('title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('number', {number: order.number})}</p>
      </div>

      <div className="mt-8 rounded-lg border bg-card p-4">
        {/* Snapshot lines: name/price captured at order time — immune to later
            catalog edits. */}
        <ul className="flex flex-col gap-2 border-b pb-3 text-sm">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 flex-1">
                {item.nameSnapshot} <span className="text-muted-foreground">×{item.qty}</span>
              </span>
              <span className="tabular-nums whitespace-nowrap">
                {formatMillimes(item.lineTotalMillimes)} {currencyLabel}
              </span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">{tCart('subtotal')}</dt>
            <dd className="tabular-nums">
              {formatMillimes(order.subtotalMillimes)} {currencyLabel}
            </dd>
          </div>
          {order.promoDiscountMillimes > 0 && (
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">
                {tCart('promoDiscount')}
                {order.promoCode !== null && (
                  <>
                    {' '}
                    <span dir="ltr" className="text-xs">
                      ({order.promoCode})
                    </span>
                  </>
                )}
              </dt>
              <dd dir="ltr" className="tabular-nums text-primary">
                -{formatMillimes(order.promoDiscountMillimes)} {currencyLabel}
              </dd>
            </div>
          )}
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">{tCart('delivery')}</dt>
            <dd className="tabular-nums">
              {order.deliveryCostMillimes === 0
                ? tCart('deliveryFree')
                : `${formatMillimes(order.deliveryCostMillimes)} ${currencyLabel}`}
            </dd>
          </div>
          <div className="flex items-center justify-between border-t pt-2 text-base font-semibold">
            <dt>{tCart('total')}</dt>
            <dd className="tabular-nums">
              {formatMillimes(order.totalMillimes)} {currencyLabel}
            </dd>
          </div>
        </dl>
      </div>

      <p className="mt-4 rounded-lg border bg-muted/50 p-4 text-center text-sm">
        {t('codNote')}
      </p>

      <div className="mt-8 flex justify-center">
        <Button render={<Link href="/" />}>{t('backHome')}</Button>
      </div>
    </div>
  );
}
