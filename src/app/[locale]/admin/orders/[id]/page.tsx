import {ArrowLeft, Printer} from 'lucide-react';
import {notFound} from 'next/navigation';
import {getTranslations} from 'next-intl/server';
import {Button} from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {PageHeader, PageTitle, Panel} from '@/components/admin/form';
import {OrderStatusBadge} from '@/components/admin/order-status-badge';
import {Overline, StatusLabel} from '@/components/admin/ui';
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
      <PageHeader
        back={
          <Button
            variant="ghost"
            size="icon"
            className="size-10 rounded-full"
            aria-label={t('backToList')}
            render={<Link href="/admin/orders" />}
          >
            <ArrowLeft className="rtl:rotate-180" />
          </Button>
        }
        title={
          <PageTitle dir="ltr" className="text-2xl">
            {t('orderTitle', {number: order.number})}
          </PageTitle>
        }
        badges={
          <>
            <OrderStatusBadge status={order.status} />
            {archived && <StatusLabel tone="neutral">{t('archived')}</StatusLabel>}
          </>
        }
        meta={dateFormatter.format(order.createdAt)}
        actions={
          <>
            {/* Invoice lives OUTSIDE /admin (print-clean, no chrome — see the
                routing note in [locale]/invoice/[id]/page.tsx); new tab so the
                admin keeps the detail page open while printing. */}
            <Button
              variant="ghost"
              className="h-10 bg-(--admin-neutral-soft) px-4"
              render={<Link href={`/invoice/${order.id}`} target="_blank" rel="noopener" />}
            >
              <Printer /> {t('invoice')}
            </Button>
            {/* Staff-wide: a SUB_ADMIN may correct the customer details on a
                live order. The component itself keeps archive/restore behind
                canArchive, and both server actions re-check their own role. */}
            <OrderAdminActions
              canArchive={isAdmin}
              order={{
                id: order.id,
                customerName: order.customerName,
                customerPhone: order.customerPhone,
                customerAddress: order.customerAddress,
                notes: order.notes,
                archived
              }}
            />
          </>
        }
      />

      {/* min-w-0 on the grid children: without it a grid item's automatic
          minimum size is its content's min-content width, and the items table
          would widen the whole page instead of scrolling inside its card. */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
          <Panel title={t('itemsCard')} flush>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="ps-5 sm:ps-6">{t('product')}</TableHead>
                  <TableHead>{t('unitPrice')}</TableHead>
                  <TableHead>{t('qty')}</TableHead>
                  <TableHead className="pe-5 text-end sm:pe-6">{t('lineTotal')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="ps-5 font-semibold sm:ps-6">
                      {/* Snapshot names — Arabic views prefer the Arabic
                          snapshot, || falls back for pre-Task-1 items. */}
                      {locale === 'ar'
                        ? item.nameArSnapshot || item.nameSnapshot
                        : item.nameSnapshot}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {formatMillimes(item.unitPriceMillimes)} {currencyLabel}
                    </TableCell>
                    <TableCell className="tabular-nums">{item.qty}</TableCell>
                    <TableCell className="pe-5 text-end font-semibold tabular-nums sm:pe-6">
                      {formatMillimes(item.lineTotalMillimes)} {currencyLabel}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>

          <Panel title={t('totalsCard')}>
            <dl className="flex flex-col gap-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">{t('subtotal')}</dt>
                <dd className="font-semibold tabular-nums">
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
                  <dd dir="ltr" className="font-semibold tabular-nums text-(--admin-success)">
                    -{formatMillimes(order.promoDiscountMillimes)} {currencyLabel}
                  </dd>
                </div>
              )}
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">{t('delivery')}</dt>
                <dd className="font-semibold tabular-nums">
                  {order.deliveryCostMillimes === 0
                    ? t('deliveryFree')
                    : `${formatMillimes(order.deliveryCostMillimes)} ${currencyLabel}`}
                </dd>
              </div>
              <div className="flex items-center justify-between border-t pt-3 text-base">
                <dt className="font-semibold">{t('totalLabel')}</dt>
                <dd className="text-lg font-bold tabular-nums">
                  {formatMillimes(order.totalMillimes)} {currencyLabel}
                </dd>
              </div>
            </dl>
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Panel title={t('statusCard')} bodyClassName="flex flex-col gap-4">
            <div>
              <OrderStatusBadge status={order.status} />
            </div>
            {/* Task 2 carry-forward (binding): archived orders are view-only —
                no status-transition buttons, restore lives in the admin
                actions above. */}
            {!archived && <StatusControl orderId={order.id} status={order.status} />}
          </Panel>

          <Panel title={t('customerCard')} bodyClassName="flex flex-col gap-4 text-sm">
            <div>
              <div className="font-semibold">{order.customerName}</div>
              <div dir="ltr" className="text-muted-foreground">{order.customerPhone}</div>
            </div>
            <div className="flex flex-col gap-1">
              <Overline>{t('address')}</Overline>
              <div>{order.customerAddress}</div>
            </div>
            {order.notes !== null && (
              <div className="flex flex-col gap-1">
                <Overline>{t('notes')}</Overline>
                <div>{order.notes}</div>
              </div>
            )}
            <div className="flex flex-col gap-1">
              <Overline>{t('clientAccount')}</Overline>
              {order.client ? (
                <Link
                  href={`/admin/clients/${order.client.id}`}
                  className="font-medium text-(--admin-primary-dark) underline-offset-4 hover:underline"
                >
                  {order.client.name} <span dir="ltr">({order.client.email})</span>
                </Link>
              ) : (
                <div className="text-muted-foreground">{t('guest')}</div>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
