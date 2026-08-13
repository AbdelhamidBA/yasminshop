import {
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  Minus,
  ShoppingBag,
  Users,
  Wallet
} from 'lucide-react';
import {getLocale, getTranslations} from 'next-intl/server';
import {SalesChart} from '@/components/admin/charts/sales-chart';
import {StatusDonut} from '@/components/admin/charts/status-donut';
import {AdminCard, Avatar, IconBox, Overline, StatusLabel, type AdminTone} from '@/components/admin/ui';
import {Link} from '@/i18n/navigation';
import {prisma} from '@/lib/db';
import {formatMillimes} from '@/lib/money';
import type {OrderStatus} from '@/lib/orders';
import type {Delta, Range} from '@/lib/stats';
import {cn} from '@/lib/utils';
import {requirePageStaff} from '@/server/authz';
import {getParameters} from '@/server/settings';
import {getDashboardStats} from '@/server/stats';

// Admin dashboard — Minimal UI (minimals.cc) pass. requirePageStaff → both
// admin and sub-admin see it. Server component: it reads getDashboardStats(range)
// and hands the two client charts plain serializable data + colour TOKEN strings.
//
// Composition, top to bottom: a soft primary-washed welcome banner carrying the
// period switch, a row of four stat widgets (tinted IconBox → overline caption →
// large tabular number → period-over-period delta), then the two charts, then the
// recent-orders and top-products lists. Every surface is a borderless AdminCard
// separated by shadow, never by a rule.
//
// Per Task 1's review: the KPI tiles render the scalar figures and the sales
// chart renders salesSeries.count — the two are NOT reconciled (different
// windows/bases by design); the revenue tile stays the net revenue figure and
// top-products revenue is a separate gross base. No figure on this page is
// synthesised: a delta is shown only when the stats layer produced one.

const RANGES: Range[] = ['day', 'week', 'month', 'year'];

function parseRange(value: string | undefined): Range {
  return typeof value === 'string' && (RANGES as string[]).includes(value)
    ? (value as Range)
    : 'week';
}

// One status → one tone, used by BOTH the donut slices and the StatusLabel chips
// on the recent-orders rows, so a slice can never drift from its pill. The donut
// takes the tone's solid ink as a var() string (the chips take the same ink over
// its 16% wash) — no hex is spelled out in this tree.
const STATUS_TONE: Record<OrderStatus, AdminTone> = {
  PENDING: 'warning',
  CONFIRMED: 'info',
  DELIVERED: 'success',
  CANCELED: 'error'
};
const STATUS_COLORS: Record<OrderStatus, string> = {
  // Full-strength GRAPHIC hues, not the darkened ink variants: these are
  // decorative fills (donut slices, legend dots), never text on a wash.
  PENDING: 'var(--admin-warning-main)',
  CONFIRMED: 'var(--admin-info-main)',
  DELIVERED: 'var(--admin-success-main)',
  CANCELED: 'var(--admin-error-main)'
};
const STATUS_ORDER: OrderStatus[] = ['PENDING', 'CONFIRMED', 'DELIVERED', 'CANCELED'];

// Chart colours are theme tokens, never literals: light/dark both track from
// globals.css and SVG resolves var() in presentation attributes.
const CHART_COLORS = {
  accentColor: 'var(--primary)',
  axisColor: 'var(--muted-foreground)',
  gridColor: 'var(--border)',
  surfaceColor: 'var(--card)',
  tooltipBg: 'var(--popover)',
  tooltipText: 'var(--popover-foreground)'
};

const SECTION_LINK =
  'shrink-0 rounded-md text-sm font-bold text-(--admin-primary-dark) underline-offset-4 transition-opacity hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

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

  // Each widget: a tinted icon, a caption, one large tabular figure and (only
  // when the stats layer produced one) its period-over-period delta.
  const tiles: {
    key: string;
    label: string;
    value: string;
    unit?: string;
    icon: typeof Wallet;
    tone: AdminTone;
    delta: Delta | null;
  }[] = [
    {
      key: 'revenue',
      label: t('tiles.revenue'),
      value: formatMillimes(stats.revenueMillimes),
      unit: currency,
      icon: Wallet,
      tone: 'primary',
      delta: stats.deltas.revenue
    },
    {
      key: 'orders',
      label: t('tiles.orders'),
      value: nf.format(stats.ordersTotal),
      icon: ShoppingBag,
      tone: 'info',
      delta: stats.deltas.orders
    },
    {
      key: 'clients',
      label: t('tiles.clients'),
      value: nf.format(stats.clientsTotal),
      icon: Users,
      tone: 'success',
      delta: stats.deltas.clients
    },
    {
      key: 'pending',
      label: t('tiles.pending'),
      value: nf.format(stats.pendingCount),
      icon: Clock,
      tone: 'warning',
      // Pending is a pipeline snapshot, not a good/bad flow — no coloured delta.
      delta: null
    }
  ];

  // Period-over-period delta line: an up/down/flat arrow + the absolute % change
  // in the semantic ink, followed by the comparison caption. The visual row is
  // aria-hidden and paired with one sr-only sentence so assistive tech hears
  // "En hausse de 12,5% sur la période précédente" rather than loose fragments.
  // Rendered as a <div> sibling of the label/value column (never a <span> next to
  // the label) so the revenue tile's label→sibling-span value locator is intact.
  const renderDelta = (delta: Delta) => {
    const Icon =
      delta.direction === 'up'
        ? ArrowUpRight
        : delta.direction === 'down'
          ? ArrowDownRight
          : Minus;
    const tone =
      delta.direction === 'up'
        ? 'text-(--admin-success)'
        : delta.direction === 'down'
          ? 'text-(--admin-error)'
          : 'text-muted-foreground';
    const pctText = nf.format(Math.abs(delta.pct));
    const sentence =
      delta.direction === 'up'
        ? t('delta.increase', {value: pctText})
        : delta.direction === 'down'
          ? t('delta.decrease', {value: pctText})
          : t('delta.unchanged');
    return (
      <div className="mt-5 text-xs" title={sentence}>
        <span className="sr-only">{sentence}</span>
        <span
          aria-hidden="true"
          className="flex flex-wrap items-center gap-x-1.5 gap-y-1 leading-tight"
        >
          <Icon className={cn('size-4 shrink-0', tone)} />
          <span className={cn('font-bold tabular-nums', tone)}>{pctText}%</span>
          <span className="text-muted-foreground">{t('delta.caption')}</span>
        </span>
      </div>
    );
  };

  const donutData = STATUS_ORDER.map((s) => ({
    status: s,
    label: tStatus(s),
    value: stats.statusBreakdown[s],
    color: STATUS_COLORS[s]
  }));
  const statusTotal = donutData.reduce((sum, d) => sum + d.value, 0);
  const salesTotalCount = stats.salesSeries.reduce((sum, b) => sum + b.count, 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Welcome banner: a soft primary wash fading into the card surface, with
          the period switch riding on its end edge. */}
      <AdminCard className="bg-linear-to-b from-(--admin-primary-soft) to-(--card) p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {t('hero.welcome', {name: session.user.name ?? ''})}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{t('hero.subtitle')}</p>
          </div>
          <nav
            aria-label={t('rangeLabel')}
            className="flex shrink-0 flex-wrap gap-1 self-start rounded-2xl bg-(--admin-neutral-soft) p-1 sm:self-auto"
          >
            {RANGES.map((r) => (
              <Link
                key={r}
                href={`/admin?range=${r}`}
                aria-current={r === range ? 'page' : undefined}
                className={cn(
                  'inline-flex h-8 items-center rounded-xl px-2.5 text-xs font-bold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  r === range
                    ? 'shadow-card bg-card text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {t(`range.${r}`)}
              </Link>
            ))}
          </nav>
        </div>
      </AdminCard>

      {/* Stat widgets */}
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <AdminCard key={tile.key} className="min-w-0 p-6">
              <IconBox tone={tile.tone}>
                <Icon className="size-6" />
              </IconBox>
              {/* Exactly two children: the caption span and its value span. */}
              <div className="mt-5 flex min-w-0 flex-col gap-2">
                <Overline className="truncate">{tile.label}</Overline>
                <span className="truncate text-3xl leading-none font-bold tracking-tight tabular-nums">
                  {tile.unit ? (
                    // dir="ltr" + inline-flex: an amount and its currency are ONE
                    // ltr run separated by a layout gap, so RTL can neither reorder
                    // them nor swallow the space (a logical margin would land on the
                    // far edge once bidi has resolved the digits+Latin run).
                    <span dir="ltr" className="inline-flex items-baseline gap-1.5">
                      {tile.value}
                      <span className="text-base font-semibold text-muted-foreground">
                        {tile.unit}
                      </span>
                    </span>
                  ) : (
                    tile.value
                  )}
                </span>
              </div>
              {tile.delta ? renderDelta(tile.delta) : null}
            </AdminCard>
          );
        })}
      </div>

      {/* Sales area chart (wide) + orders-by-status donut */}
      <div className="grid gap-6 lg:grid-cols-3">
        <AdminCard className="flex min-w-0 flex-col lg:col-span-2">
          <div className="p-6 pb-2">
            <h2 className="text-lg font-bold tracking-tight">{t('sales.title')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('sales.subtitle', {count: nf.format(salesTotalCount)})}
            </p>
          </div>
          {/* flex-1: the plot fills whatever height the donut card sets for the row. */}
          <div className="min-h-[260px] flex-1 px-2 pb-4 sm:min-h-[300px]">
            <SalesChart
              data={stats.salesSeries}
              seriesLabel={t('sales.seriesLabel')}
              emptyLabel={t('empty')}
              {...CHART_COLORS}
            />
          </div>
        </AdminCard>

        <AdminCard className="flex min-w-0 flex-col">
          <div className="p-6 pb-2">
            <h2 className="text-lg font-bold tracking-tight">{t('status.title')}</h2>
          </div>
          <div className="px-6 pt-2">
            <div className="relative mx-auto w-full max-w-[240px]">
              <StatusDonut data={donutData} emptyLabel={t('empty')} {...CHART_COLORS} />
              {statusTotal > 0 && (
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <span className="text-3xl leading-none font-bold tabular-nums">
                    {nf.format(statusTotal)}
                  </span>
                  <Overline>{t('status.total')}</Overline>
                </div>
              )}
            </div>
          </div>
          <ul className="flex flex-col gap-3 p-6">
            {donutData.map((slice) => (
              <li key={slice.status} className="flex items-center gap-3 text-sm">
                <span
                  aria-hidden="true"
                  className="size-2.5 shrink-0 rounded-full"
                  style={{background: slice.color}}
                />
                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                  {slice.label}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {nf.format(slice.value)}
                </span>
                <span className="w-11 text-end font-bold tabular-nums">
                  {statusTotal > 0 ? Math.round((slice.value / statusTotal) * 100) : 0}%
                </span>
              </li>
            ))}
          </ul>
        </AdminCard>
      </div>

      {/* Recent orders (wide) + top products */}
      <div className="grid gap-6 lg:grid-cols-3">
        <AdminCard className="min-w-0 lg:col-span-2">
          <div className="flex items-center justify-between gap-4 p-6 pb-3">
            <h2 className="min-w-0 truncate text-lg font-bold tracking-tight">
              {t('recent.title')}
            </h2>
            <Link href="/admin/orders" className={SECTION_LINK}>
              {t('recent.viewAll')}
            </Link>
          </div>
          {stats.recentOrders.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">{t('recent.empty')}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-dashed px-3 pb-3">
              {stats.recentOrders.map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-(--admin-neutral-soft) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <Avatar name={order.customerName} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{order.customerName}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        <span dir="ltr">#{order.number}</span>
                        <span aria-hidden="true"> · </span>
                        {dateFormatter.format(order.createdAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span
                        dir="ltr"
                        className="inline-flex items-baseline gap-1 text-sm font-bold tabular-nums"
                      >
                        {formatMillimes(order.totalMillimes)}
                        <span className="text-xs font-medium text-muted-foreground">
                          {currency}
                        </span>
                      </span>
                      <StatusLabel tone={STATUS_TONE[order.status]}>
                        {tStatus(order.status)}
                      </StatusLabel>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </AdminCard>

        <AdminCard className="min-w-0">
          <div className="flex items-center justify-between gap-4 p-6 pb-3">
            <h2 className="min-w-0 truncate text-lg font-bold tracking-tight">
              {t('top.title')}
            </h2>
            <Link href="/admin/products" className={SECTION_LINK}>
              {t('top.viewAll')}
            </Link>
          </div>
          {stats.topProducts.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">{t('top.empty')}</p>
          ) : (
            <ul className="flex flex-col gap-1 px-3 pb-4">
              {stats.topProducts.map((product) => {
                const name = locale === 'ar' ? product.nameAr : product.nameFr;
                const imageUrl = imageByProduct.get(product.id) ?? '/placeholder-product.svg';
                return (
                  <li key={product.id} className="flex items-center gap-3 px-3 py-2.5">
                    {/* Plain <img>: uploads are served same-origin from /api/uploads. */}
                    <img
                      src={imageUrl}
                      alt={name}
                      loading="lazy"
                      className="size-12 shrink-0 rounded-xl bg-(--admin-neutral-soft) object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t('top.sold', {count: nf.format(product.sold)})}
                      </p>
                    </div>
                    <span
                      dir="ltr"
                      className="inline-flex shrink-0 items-baseline gap-1 text-sm font-bold tabular-nums text-(--admin-success)"
                    >
                      {formatMillimes(product.revenueMillimes)}
                      <span className="text-xs font-medium text-muted-foreground">
                        {currency}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </AdminCard>
      </div>
    </div>
  );
}
