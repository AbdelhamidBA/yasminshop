import {getTranslations, setRequestLocale} from 'next-intl/server';
import {OrderStatusBadge} from '@/components/admin/order-status-badge';
import {Button} from '@/components/ui/button';
import {Link} from '@/i18n/navigation';
import {formatMillimes} from '@/lib/money';
import {requirePageUser} from '@/server/authz';
import {listClientOrders} from '@/server/orders';
import {getParameters} from '@/server/settings';

// My Orders — any signed-in role (anonymous → locale-aware /login redirect).
// Lists ONLY the session user's orders: clientId is pinned from the session,
// so one client can never see another's orders (or the guest orders, whose
// clientId is null). Items render inline (simple list per the plan — the
// confirmation page stays the deep-link view).
export default async function MyOrdersPage({
  params
}: {
  params: Promise<{locale: string}>;
}) {
  const session = await requirePageUser();
  const {locale} = await params;
  setRequestLocale(locale);

  const [t, parameters, orders] = await Promise.all([
    getTranslations('myOrders'),
    getParameters(),
    listClientOrders(session.user.id)
  ]);

  const currencyLabel = parameters.currency;
  const dateFormatter = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-TN' : 'fr-TN', {
    dateStyle: 'long',
    timeStyle: 'short'
  });

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">{t('title')}</h1>

      {orders.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-4 rounded-lg border bg-card p-10 text-center">
          <p className="text-muted-foreground">{t('empty')}</p>
          <Button render={<Link href="/products" />}>{t('browseCta')}</Button>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {orders.map((order) => (
            <li key={order.id} className="rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span dir="ltr" className="font-semibold">#{order.number}</span>
                {/* Shared presentational badge (admin palette) — labels come
                    from adminOrders.status, the single source for status
                    wording. */}
                <OrderStatusBadge status={order.status} />
                <span className="text-sm text-muted-foreground">
                  {dateFormatter.format(order.createdAt)}
                </span>
                <span className="ms-auto text-sm">
                  <span className="text-muted-foreground">{t('total')}</span>{' '}
                  <span className="font-semibold tabular-nums whitespace-nowrap">
                    {formatMillimes(order.totalMillimes)} {currencyLabel}
                  </span>
                </span>
              </div>
              {/* Snapshot lines — Arabic views prefer the Arabic snapshot,
                  || falls back for items predating nameArSnapshot. */}
              <ul className="mt-3 flex flex-col gap-2 border-t pt-3 text-sm">
                {order.items.map((item) => (
                  <li key={item.id} className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 flex-1">
                      {locale === 'ar'
                        ? item.nameArSnapshot || item.nameSnapshot
                        : item.nameSnapshot}{' '}
                      <span className="text-muted-foreground">×{item.qty}</span>
                    </span>
                    <span className="tabular-nums whitespace-nowrap">
                      {formatMillimes(item.lineTotalMillimes)} {currencyLabel}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
