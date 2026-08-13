import {AlertTriangle, Archive, Boxes, PackageX} from 'lucide-react';
import {getTranslations} from 'next-intl/server';
import {AdminCard, IconBox, Overline, type AdminTone} from '@/components/admin/ui';
import {Link} from '@/i18n/navigation';
import {cn} from '@/lib/utils';
import type {ProductStats as ProductStatsData} from '@/server/products';

// Inventory summary above the products list. Same widget composition as the
// dashboard tiles (tinted IconBox → tracked Overline caption → one large
// tabular figure → an optional small footnote line), just tighter padding so
// the row stays a header rather than a second page.
//
// Two of the four tiles are LINKS, and only because the list genuinely
// implements those states: `/admin/products` is the active-only view and
// `?archived=1` reveals archived rows (see products/page.tsx searchParams).
// There is no stock filter on the list, so the rupture/low-stock tiles are
// plain text — a tile never promises a filter that does not exist. The links
// drop any active `q` on purpose: the counts describe the whole catalogue, so
// they must land on the whole catalogue.
//
// Read-only, so it renders for ADMIN and SUB_ADMIN alike — every figure here is
// derived from the product rows a sub-admin already sees in the table below.

type Tile = {
  key: string;
  label: string;
  value: number;
  icon: typeof Boxes;
  tone: AdminTone;
  href?: string;
  hint?: string;
};

export async function ProductStats({
  stats,
  lowStockThreshold
}: {
  stats: ProductStatsData;
  lowStockThreshold: number;
}) {
  const t = await getTranslations('admin.products.stats');
  // Arabic is retired; the admin renders in French, and these are the same
  // grouped figures the dashboard tiles use.
  const nf = new Intl.NumberFormat('fr-TN');

  const tiles: Tile[] = [
    {
      key: 'total',
      label: t('total'),
      value: stats.total,
      icon: Boxes,
      tone: 'primary',
      href: '/admin/products'
    },
    {
      key: 'outOfStock',
      label: t('outOfStock'),
      value: stats.outOfStock,
      icon: PackageX,
      tone: 'error'
    },
    {
      key: 'lowStock',
      label: t('lowStock'),
      value: stats.lowStock,
      icon: AlertTriangle,
      tone: 'warning',
      // Names the owner-configured threshold so the figure is never a mystery.
      hint: t('hint.lowStock', {count: lowStockThreshold})
    },
    {
      key: 'archived',
      label: t('archived'),
      value: stats.archived,
      icon: Archive,
      tone: 'neutral',
      href: '/admin/products?archived=1'
    }
  ];

  return (
    // 2-up from the narrowest width, 4-up from xl: at 390px the row wraps into
    // two columns inside the page's own padding — it never scrolls the page.
    <div className="grid grid-cols-2 gap-4 sm:gap-6 xl:grid-cols-4">
      {tiles.map((tile) => {
        const Icon = tile.icon;
        const body = (
          // h-full so every tile in a grid row shares the tallest height even
          // when only one of them carries a hint line.
          <AdminCard
            className={cn(
              'h-full min-w-0 p-4 sm:p-5',
              tile.href && 'transition-colors group-hover:bg-(--admin-neutral-soft)'
            )}
          >
            <IconBox tone={tile.tone}>
              <Icon className="size-6" />
            </IconBox>
            <div className="mt-4 flex min-w-0 flex-col gap-2">
              <Overline>{tile.label}</Overline>
              <span className="truncate text-2xl leading-none font-bold tracking-tight tabular-nums sm:text-3xl">
                {nf.format(tile.value)}
              </span>
            </div>
            {tile.hint ? (
              <p className="mt-3 text-xs leading-tight text-muted-foreground">{tile.hint}</p>
            ) : null}
          </AdminCard>
        );

        return tile.href ? (
          <Link
            key={tile.key}
            href={tile.href}
            className="group block rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {body}
          </Link>
        ) : (
          <div key={tile.key}>{body}</div>
        );
      })}
    </div>
  );
}
