'use client';

import {
  FolderTree,
  LayoutDashboard,
  Package,
  Settings,
  Shield,
  ShoppingBag,
  TicketPercent,
  Users
} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {Link, usePathname} from '@/i18n/navigation';
import {Overline} from '@/components/admin/ui';
import {cn} from '@/lib/utils';

// The admin navigation ITSELF — the list of destinations and how a nav item
// looks. It is rendered twice, from two shells: the desktop rail
// (admin-sidebar.tsx) and the mobile drawer (admin-mobile-nav.tsx). Keeping it
// here means the two can never drift, and ADMIN-only entries are filtered in
// exactly ONE place.
//
// `collapsed` is the desktop rail's mini mode (icons only). The drawer is
// always expanded, and passes `onNavigate` so a selection closes it —
// client-side navigation keeps the layout (and the drawer's state) mounted.

type NavItem = {
  href: string;
  labelKey:
    | 'overview'
    | 'clients'
    | 'products'
    | 'orders'
    | 'categories'
    | 'promoCodes'
    | 'subAdmins'
    | 'parameters';
  icon: typeof Users;
};

const DASHBOARD_ITEMS: NavItem[] = [
  {href: '/admin', labelKey: 'overview', icon: LayoutDashboard},
  {href: '/admin/clients', labelKey: 'clients', icon: Users},
  {href: '/admin/products', labelKey: 'products', icon: Package},
  {href: '/admin/orders', labelKey: 'orders', icon: ShoppingBag},
  {href: '/admin/categories', labelKey: 'categories', icon: FolderTree},
  {href: '/admin/promo-codes', labelKey: 'promoCodes', icon: TicketPercent}
];

export function AdminNav({
  isAdmin,
  collapsed = false,
  onNavigate
}: {
  isAdmin: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const t = useTranslations('admin');
  const pathname = usePathname();

  // /admin/sub-admins is ADMIN-only (the page itself notFound()s for a
  // SUB_ADMIN); the rail and the drawer must not advertise it either.
  const settingsItems: NavItem[] = [
    ...(isAdmin ? ([{href: '/admin/sub-admins', labelKey: 'subAdmins', icon: Shield}] as NavItem[]) : []),
    {href: '/admin/parameters', labelKey: 'parameters', icon: Settings}
  ];

  function renderBlock(title: string, items: NavItem[]) {
    return (
      <div className="px-3 py-2">
        <p className={cn('mb-2 px-3', collapsed && 'hidden')}>
          <Overline>{title}</Overline>
        </p>
        <ul className="flex flex-col gap-1">
          {items.map((item) => {
            const active =
              item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
            const Icon = item.icon;
            const label = t(`nav.${item.labelKey}`);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  title={label}
                  aria-label={label}
                  aria-current={active ? 'page' : undefined}
                  onClick={onNavigate}
                  className={cn(
                    'flex h-11 items-center rounded-lg text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                    collapsed ? 'justify-center' : 'justify-start gap-3 px-3',
                    active
                      ? 'bg-(--admin-primary-soft) font-semibold text-(--admin-primary-dark)'
                      : 'font-medium text-muted-foreground hover:bg-(--admin-neutral-soft) hover:text-foreground'
                  )}
                >
                  <Icon className="size-5 shrink-0" strokeWidth={active ? 2.2 : 1.8} />
                  <span className={cn('truncate', collapsed && 'hidden')}>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <>
      {renderBlock(t('blocks.dashboard'), DASHBOARD_ITEMS)}
      {/* Stands in for the group caption while it is hidden (mini rail). */}
      <div
        className={cn('mx-auto h-px w-6 rounded-full bg-border', !collapsed && 'hidden')}
      />
      {renderBlock(t('blocks.settings'), settingsItems)}
    </>
  );
}
