import {ArrowLeft} from 'lucide-react';
import {notFound} from 'next/navigation';
import {getTranslations} from 'next-intl/server';
import {Button} from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {PageHeader, PageTitle, Panel} from '@/components/admin/form';
import {OrderStatusBadge} from '@/components/admin/order-status-badge';
import {Avatar, Overline, StatusLabel} from '@/components/admin/ui';
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

  // Profile rows are label/value pairs; a null optional renders the shared
  // "not provided" dash in secondary ink rather than an invented value.
  const profile: Array<{label: string; value: string; dir?: 'ltr'; muted?: boolean}> = [
    {label: t('email'), value: client.email, dir: 'ltr'},
    {label: t('phone'), value: client.phone ?? dash, dir: 'ltr', muted: client.phone === null},
    {label: t('address'), value: client.address ?? dash, muted: client.address === null},
    {label: t('city'), value: client.city ?? dash, muted: client.city === null},
    {label: t('joined'), value: joinedFormatter.format(client.createdAt)},
    {label: t('orders'), value: String(client._count.orders)}
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back={
          <Button
            variant="ghost"
            size="icon"
            className="size-10 rounded-full"
            aria-label={t('backToList')}
            render={<Link href="/admin/clients" />}
          >
            <ArrowLeft className="rtl:rotate-180" />
          </Button>
        }
        title={
          <span className="flex items-center gap-3">
            <Avatar name={client.name} />
            <PageTitle>{client.name}</PageTitle>
          </span>
        }
        badges={archived ? <StatusLabel tone="neutral">{t('archived')}</StatusLabel> : undefined}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel
          title={t('profileCard')}
          className="self-start"
          bodyClassName="flex flex-col gap-4 text-sm"
        >
          {profile.map((row) => (
            <div key={row.label} className="flex flex-col gap-1">
              <Overline>{row.label}</Overline>
              <div dir={row.dir} className={row.muted ? 'text-muted-foreground' : undefined}>
                {row.value}
              </div>
            </div>
          ))}
        </Panel>

        {client.orders.length === 0 ? (
          <Panel title={t('ordersCard')} className="self-start lg:col-span-2">
            <p className="rounded-xl bg-(--admin-neutral-soft) px-4 py-6 text-center text-sm text-muted-foreground">
              {t('noOrders')}
            </p>
          </Panel>
        ) : (
          <Panel title={t('ordersCard')} flush className="min-w-0 self-start lg:col-span-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="ps-5 sm:ps-6">{t('number')}</TableHead>
                  <TableHead>{t('date')}</TableHead>
                  <TableHead>{t('items')}</TableHead>
                  <TableHead>{t('total')}</TableHead>
                  <TableHead className="pe-5 sm:pe-6">{t('statusHeader')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {client.orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="ps-5 font-semibold sm:ps-6">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        dir="ltr"
                        className="text-(--admin-primary-dark) underline-offset-4 hover:underline"
                      >
                        #{order.number}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {orderDateFormatter.format(order.createdAt)}
                    </TableCell>
                    <TableCell className="tabular-nums">{order._count.items}</TableCell>
                    <TableCell className="font-semibold tabular-nums">
                      {formatMillimes(order.totalMillimes)} {currencyLabel}
                    </TableCell>
                    <TableCell className="pe-5 sm:pe-6">
                      <OrderStatusBadge status={order.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
        )}
      </div>
    </div>
  );
}
