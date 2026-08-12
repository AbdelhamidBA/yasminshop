import {ArrowLeft, Printer} from 'lucide-react';
import {notFound} from 'next/navigation';
import {getTranslations} from 'next-intl/server';
import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {
  Card, CardContent, CardHeader, CardTitle
} from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {OrderStatusBadge} from '@/components/admin/order-status-badge';
import {Link} from '@/i18n/navigation';
import {formatMillimes} from '@/lib/money';
import {requirePageStaff} from '@/server/authz';
import {getOrder} from '@/server/orders';
import {getParameters} from '@/server/settings';
import {OrderAdminActions} from './order-admin-actions';
import {StatusControl} from './status-control';

export default async function OrderDetailPage({
  params
}: {
  params: Promise<{locale: string; id: string}>;
}) {
  const session = await requirePageStaff();
  const {locale, id} = await params;
  const [t, parameters, order] = await Promise.all([
    getTranslations('adminOrders'),
    getParameters(),
    getOrder(id)
  ]);
  if (!order) notFound();

  const isAdmin = session.user.role === 'ADMIN';
  const archived = order.archivedAt !== null;
  const currencyLabel = parameters.currency;
  const dateFormatter = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-TN' : 'fr-TN', {
    dateStyle: 'long',
    timeStyle: 'short'
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" aria-label={t('backToList')} render={<Link href="/admin/orders" />}>
          <ArrowLeft className="size-4 rtl:rotate-180" />
        </Button>
        <h1 dir="ltr" className="text-2xl font-semibold">#{order.number}</h1>
        <OrderStatusBadge status={order.status} />
        {archived && <Badge variant="outline">{t('archived')}</Badge>}
        <span className="text-sm text-muted-foreground">
          {dateFormatter.format(order.createdAt)}
        </span>
        <div className="ms-auto flex items-center gap-2">
          <Button variant="outline" render={<Link href={`/admin/orders/${order.id}/invoice`} />}>
            <Printer className="size-4" /> {t('invoice')}
          </Button>
          {isAdmin && (
            <OrderAdminActions
              order={{
                id: order.id,
                customerName: order.customerName,
                customerPhone: order.customerPhone,
                customerAddress: order.customerAddress,
                notes: order.notes,
                archived
              }}
            />
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{t('itemsCard')}</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="ps-4">{t('product')}</TableHead>
                    <TableHead>{t('unitPrice')}</TableHead>
                    <TableHead>{t('qty')}</TableHead>
                    <TableHead className="pe-4 text-end">{t('lineTotal')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="ps-4 font-medium">
                        {/* Snapshot names — Arabic views prefer the Arabic
                            snapshot, || falls back for pre-Task-1 items. */}
                        {locale === 'ar'
                          ? item.nameArSnapshot || item.nameSnapshot
                          : item.nameSnapshot}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatMillimes(item.unitPriceMillimes)} {currencyLabel}
                      </TableCell>
                      <TableCell>{item.qty}</TableCell>
                      <TableCell className="pe-4 text-end tabular-nums">
                        {formatMillimes(item.lineTotalMillimes)} {currencyLabel}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('totalsCard')}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="flex flex-col gap-2 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">{t('subtotal')}</dt>
                  <dd className="tabular-nums">
                    {formatMillimes(order.subtotalMillimes)} {currencyLabel}
                  </dd>
                </div>
                {order.promoDiscountMillimes > 0 && (
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">
                      {t('promoDiscount')}
                      {order.promoCode !== null && (
                        <>
                          {' '}
                          <span dir="ltr" className="text-xs">({order.promoCode})</span>
                        </>
                      )}
                    </dt>
                    <dd dir="ltr" className="tabular-nums text-primary">
                      -{formatMillimes(order.promoDiscountMillimes)} {currencyLabel}
                    </dd>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">{t('delivery')}</dt>
                  <dd className="tabular-nums">
                    {order.deliveryCostMillimes === 0
                      ? t('deliveryFree')
                      : `${formatMillimes(order.deliveryCostMillimes)} ${currencyLabel}`}
                  </dd>
                </div>
                <div className="flex items-center justify-between border-t pt-2 text-base font-semibold">
                  <dt>{t('totalLabel')}</dt>
                  <dd className="tabular-nums">
                    {formatMillimes(order.totalMillimes)} {currencyLabel}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('statusCard')}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div>
                <OrderStatusBadge status={order.status} />
              </div>
              {/* Task 2 carry-forward (binding): archived orders are view-only —
                  no status-transition buttons, restore lives in the admin
                  actions above. */}
              {!archived && <StatusControl orderId={order.id} status={order.status} />}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('customerCard')}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <div>
                <div className="font-medium">{order.customerName}</div>
                <div dir="ltr" className="text-muted-foreground">{order.customerPhone}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{t('address')}</div>
                <div>{order.customerAddress}</div>
              </div>
              {order.notes !== null && (
                <div>
                  <div className="text-xs text-muted-foreground">{t('notes')}</div>
                  <div>{order.notes}</div>
                </div>
              )}
              <div>
                <div className="text-xs text-muted-foreground">{t('clientAccount')}</div>
                {order.client ? (
                  <Link
                    href={`/admin/clients/${order.client.id}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {order.client.name} <span dir="ltr">({order.client.email})</span>
                  </Link>
                ) : (
                  <div className="text-muted-foreground">{t('guest')}</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
