import {Clock, ShoppingBag, Users, Wallet} from 'lucide-react';
import {getLocale, getTranslations} from 'next-intl/server';
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {SalesChart} from '@/components/admin/charts/sales-chart';
import {StatusDonut} from '@/components/admin/charts/status-donut';
import {OrderStatusBadge} from '@/components/admin/order-status-badge';
import {Link} from '@/i18n/navigation';
import {prisma} from '@/lib/db';
import {formatMillimes} from '@/lib/money';
import type {OrderStatus} from '@/lib/orders';
import type {Range} from '@/lib/stats';
import {cn} from '@/lib/utils';
import {requirePageStaff} from '@/server/authz';
import {getParameters} from '@/server/settings';
import {getDashboardStats} from '@/server/stats';

// Admin dashboard (Phase 5, reference-image layout). requirePageStaff → both
// admin and sub-admin see it. Server component: it reads Task 1's
// getDashboardStats(range) and hands the two client charts plain serializable
// data + explicit color strings. Per Task 1's review: the KPI tiles render the
// scalar figures and the sales chart renders salesSeries.count ("Orders") — the
// two are NOT reconciled (different windows/bases by design); the revenue tile
// stays the net revenue figure, top-products revenue is a separate gross base.

const RANGES: Range[] = ['day', 'week', 'month', 'year'];

function parseRange(value: string | undefined): Range {
  return typeof value === 'string' && (RANGES as string[]).includes(value)
    ? (value as Range)
    : 'week';
}

// Donut palette — mirrors the OrderStatusBadge colors (amber/blue/green/red).
// Fixed hues that stay legible on both light and dark card surfaces; passed to
// the client donut + reused by the server-rendered legend so they never drift.
const STATUS_COLORS: Record<OrderStatus, string> = {
  PENDING: '#f59e0b',
  CONFIRMED: '#3b82f6',
  DELIVERED: '#22c55e',
  CANCELED: '#ef4444'
};
const STATUS_ORDER: OrderStatus[] = ['PENDING', 'CONFIRMED', 'DELIVERED', 'CANCELED'];

// Structural chart colors are CSS-var strings (theme tokens) so light/dark both
// track automatically; the sales accent is an explicit brand green.
const CHART_TOOLTIP = {
  tooltipBg: 'var(--popover)',
  tooltipBorder: 'var(--border)',
  tooltipText: 'var(--popover-foreground)'
};

export default async function AdminOverviewPage({
  searchParams
}: {
  searchParams: Promise<{range?: string}>;
}) {
  const session = await requirePageStaff();
  const {range: rawRange} = await searchParams;
  const range = parseRange(rawRange);

  const [t, tStatus, locale, parameters, stats] = await Promise.all([
    getTranslations('dashboard'),
    getTranslations('adminOrders.status'),
    getLocale(),
    getParameters(),
    getDashboardStats(range)
  ]);

  // Thumbnails for the top-products list: getDashboardStats returns ids only, so
  // fetch the primary image (lowest sortOrder) for the ranked ids in one query.
  const topIds = stats.topProducts.map((p) => p.id);
  const productImages =
    topIds.length > 0
      ? await prisma.productImage.findMany({
          where: {productId: {in: topIds}},
          orderBy: {sortOrder: 'asc'},
          select: {productId: true, url: true}
        })
      : [];
  const imageByProduct = new Map<string, string>();
  for (const img of productImages) {
    if (!imageByProduct.has(img.productId)) imageByProduct.set(img.productId, img.url);
  }

  const intlLocale = locale === 'ar' ? 'ar-TN' : 'fr-TN';
  const nf = new Intl.NumberFormat(intlLocale);
  const dateFormatter = new Intl.DateTimeFormat(intlLocale, {dateStyle: 'medium'});
  const currency = parameters.currency;

  const tiles = [
    {
      key: 'revenue',
      label: t('tiles.revenue'),
      value: `${formatMillimes(stats.revenueMillimes)} ${currency}`,
      icon: Wallet,
      chip: 'bg-green-500/10 text-green-600 dark:text-green-400'
    },
    {
      key: 'orders',
      label: t('tiles.orders'),
      value: nf.format(stats.ordersTotal),
      icon: ShoppingBag,
      chip: 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
    },
    {
      key: 'clients',
      label: t('tiles.clients'),
      value: nf.format(stats.clientsTotal),
      icon: Users,
      chip: 'bg-violet-500/10 text-violet-600 dark:text-violet-400'
    },
    {
      key: 'pending',
      label: t('tiles.pending'),
      value: nf.format(stats.pendingCount),
      icon: Clock,
      chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
    }
  ];

  const donutData = STATUS_ORDER.map((s) => ({
    status: s,
    label: tStatus(s),
    value: stats.statusBreakdown[s],
    color: STATUS_COLORS[s]
  }));
  const statusTotal = donutData.reduce((sum, d) => sum + d.value, 0);
  const salesTotalCount = stats.salesSeries.reduce((sum, b) => sum + b.count, 0);

  const rangeTabClass = (r: Range) =>
    cn(
      'inline-flex h-8 items-center rounded-md px-3 text-sm font-medium transition-colors',
      r === range ? 'bg-primary text-primary-foreground' : 'border hover:bg-accent'
    );

  return (
    <div className="flex flex-col gap-6">
      {/* Hero: welcome + range selector */}
      <div className="flex flex-col gap-4 rounded-xl bg-gradient-to-br from-green-500/10 to-transparent p-6 ring-1 ring-foreground/10 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">
            {t('hero.welcome', {name: session.user.name ?? ''})}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('hero.subtitle')}</p>
        </div>
        <div
          className="flex flex-wrap gap-2"
          role="navigation"
          aria-label={t('rangeLabel')}
        >
          {RANGES.map((r) => (
            <Link key={r} href={`/admin?range=${r}`} className={rangeTabClass(r)}>
              {t(`range.${r}`)}
            </Link>
          ))}
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <Card key={tile.key}>
              <CardContent className="flex items-center gap-4">
                <span
                  className={cn(
                    'flex size-11 shrink-0 items-center justify-center rounded-xl',
                    tile.chip
                  )}
                >
                  <Icon className="size-5" />
                </span>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm text-muted-foreground">{tile.label}</span>
                  <span className="text-2xl font-semibold tabular-nums">{tile.value}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts: sales overview (left) + status donut (right) */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t('sales.title')}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {t('sales.subtitle', {count: nf.format(salesTotalCount)})}
            </p>
          </CardHeader>
          <CardContent>
            <SalesChart
              data={stats.salesSeries}
              seriesLabel={t('sales.seriesLabel')}
              emptyLabel={t('empty')}
              strokeColor="#16a34a"
              fillColor="#22c55e"
              axisColor="var(--muted-foreground)"
              gridColor="var(--border)"
              {...CHART_TOOLTIP}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('status.title')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="relative mx-auto w-full max-w-56">
              <StatusDonut data={donutData} emptyLabel={t('empty')} {...CHART_TOOLTIP} />
              {statusTotal > 0 && (
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-semibold tabular-nums">
                    {nf.format(statusTotal)}
                  </span>
                  <span className="text-xs text-muted-foreground">{t('status.total')}</span>
                </div>
              )}
            </div>
            <ul className="flex flex-col gap-2">
              {donutData.map((slice) => (
                <li key={slice.status} className="flex items-center gap-2 text-sm">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{background: slice.color}}
                  />
                  <span className="flex-1 truncate">{slice.label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {nf.format(slice.value)}
                  </span>
                  <span className="w-10 text-end tabular-nums text-muted-foreground">
                    {statusTotal > 0 ? Math.round((slice.value / statusTotal) * 100) : 0}%
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Recent orders (left) + top products (right) */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t('recent.title')}</CardTitle>
            <CardAction>
              <Link
                href="/admin/orders"
                className="text-sm text-muted-foreground underline-offset-4 hover:underline"
              >
                {t('recent.viewAll')}
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent>
            {stats.recentOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('recent.empty')}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('recent.number')}</TableHead>
                    <TableHead>{t('recent.customer')}</TableHead>
                    <TableHead>{t('recent.date')}</TableHead>
                    <TableHead>{t('recent.amount')}</TableHead>
                    <TableHead>{t('recent.status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.recentOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          dir="ltr"
                          className="underline-offset-4 hover:underline"
                        >
                          #{order.number}
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-40 truncate">{order.customerName}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {dateFormatter.format(order.createdAt)}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatMillimes(order.totalMillimes)} {currency}
                      </TableCell>
                      <TableCell>
                        <OrderStatusBadge status={order.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('top.title')}</CardTitle>
            <CardAction>
              <Link
                href="/admin/products"
                className="text-sm text-muted-foreground underline-offset-4 hover:underline"
              >
                {t('top.viewAll')}
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent>
            {stats.topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('top.empty')}</p>
            ) : (
              <ul className="flex flex-col gap-4">
                {stats.topProducts.map((product) => {
                  const name = locale === 'ar' ? product.nameAr : product.nameFr;
                  const imageUrl = imageByProduct.get(product.id) ?? '/placeholder-product.svg';
                  return (
                    <li key={product.id} className="flex items-center gap-3">
                      {/* Plain <img>: uploads are served same-origin from /api/uploads. */}
                      <img
                        src={imageUrl}
                        alt={name}
                        loading="lazy"
                        className="size-12 shrink-0 rounded-lg object-cover ring-1 ring-foreground/10"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{name}</p>
                        <p className="text-xs text-muted-foreground">
                          {t('top.sold', {count: nf.format(product.sold)})}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-medium tabular-nums text-green-600 dark:text-green-400">
                        {formatMillimes(product.revenueMillimes)} {currency}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
