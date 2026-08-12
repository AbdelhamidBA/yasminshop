import {ArrowLeft} from 'lucide-react';
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
import {getClient} from '@/server/clients';
import {getParameters} from '@/server/settings';

export default async function ClientDetailPage({
  params
}: {
  params: Promise<{locale: string; id: string}>;
}) {
  await requirePageStaff();
  const {locale, id} = await params;
  const [t, parameters, client] = await Promise.all([
    getTranslations('adminClients'),
    getParameters(),
    getClient(id)
  ]);
  if (!client) notFound();

  const archived = client.archivedAt !== null;
  const currencyLabel = parameters.currency;
  const joinedFormatter = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-TN' : 'fr-TN', {
    dateStyle: 'long'
  });
  const orderDateFormatter = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-TN' : 'fr-TN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  const dash = t('notProvided');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('backToList')}
          render={<Link href="/admin/clients" />}
        >
          <ArrowLeft className="size-4 rtl:rotate-180" />
        </Button>
        <h1 className="text-2xl font-semibold">{client.name}</h1>
        {archived && <Badge variant="outline">{t('archived')}</Badge>}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="self-start">
          <CardHeader>
            <CardTitle>{t('profileCard')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">{t('email')}</div>
              <div dir="ltr">{client.email}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">{t('phone')}</div>
              {client.phone !== null ? (
                <div dir="ltr">{client.phone}</div>
              ) : (
                <div className="text-muted-foreground">{dash}</div>
              )}
            </div>
            <div>
              <div className="text-xs text-muted-foreground">{t('address')}</div>
              <div className={client.address === null ? 'text-muted-foreground' : undefined}>
                {client.address ?? dash}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">{t('city')}</div>
              <div className={client.city === null ? 'text-muted-foreground' : undefined}>
                {client.city ?? dash}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">{t('joined')}</div>
              <div>{joinedFormatter.format(client.createdAt)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">{t('orders')}</div>
              <div>{client._count.orders}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="self-start lg:col-span-2">
          <CardHeader>
            <CardTitle>{t('ordersCard')}</CardTitle>
          </CardHeader>
          {client.orders.length === 0 ? (
            <CardContent>
              <p className="text-sm text-muted-foreground">{t('noOrders')}</p>
            </CardContent>
          ) : (
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="ps-4">{t('number')}</TableHead>
                    <TableHead>{t('date')}</TableHead>
                    <TableHead>{t('items')}</TableHead>
                    <TableHead>{t('total')}</TableHead>
                    <TableHead className="pe-4">{t('statusHeader')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {client.orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="ps-4 font-medium">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          dir="ltr"
                          className="underline-offset-4 hover:underline"
                        >
                          #{order.number}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {orderDateFormatter.format(order.createdAt)}
                      </TableCell>
                      <TableCell>{order._count.items}</TableCell>
                      <TableCell className="tabular-nums">
                        {formatMillimes(order.totalMillimes)} {currencyLabel}
                      </TableCell>
                      <TableCell className="pe-4">
                        <OrderStatusBadge status={order.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
