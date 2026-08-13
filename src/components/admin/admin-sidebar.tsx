'use client';

import {useEffect, useState} from 'react';
import {
  FolderTree,
  LayoutDashboard,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
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

const STORAGE_KEY = 'admin-sidebar-collapsed';

// Minimal-UI nav rail: paper-white, separated from the page by a dashed
// hairline rather than a solid rule, nav grouped under Overline captions, and
// an active item that reads as a soft primary wash behind primary ink.
//
// Two collapse mechanisms, deliberately: the persisted `collapsed` toggle
// (desktop, localStorage) and a CSS-only mini rail below `lg` — the rail is
// never wide enough to eat a phone screen, and no new affordance was invented
// to achieve that (the toggle simply hides where it has nothing to do).

type NavItem = {
  href: string;
  labelKey: 'overview' | 'clients' | 'products' | 'orders' | 'categories' | 'promoCodes' | 'subAdmins' | 'parameters';
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

export function AdminSidebar({isAdmin}: {isAdmin: boolean}) {
  const t = useTranslations('admin');
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(STORAGE_KEY) === '1');
  }, []);

  function toggle() {
    setCollapsed((current) => {
      localStorage.setItem(STORAGE_KEY, current ? '0' : '1');
      return !current;
    });
  }

  const settingsItems: NavItem[] = [
    ...(isAdmin ? ([{href: '/admin/sub-admins', labelKey: 'subAdmins', icon: Shield}] as NavItem[]) : []),
    {href: '/admin/parameters', labelKey: 'parameters', icon: Settings}
  ];

  // Expanded-only pieces (captions, labels) stay mounted and hide with CSS so
  // the mini rail below `lg` needs no extra state.
  const expandedOnly = collapsed ? 'hidden' : 'hidden lg:block';

  function renderBlock(title: string, items: NavItem[]) {
    return (
      <div className="px-3 py-2">
        <p className={cn('mb-2 px-3', expandedOnly)}>
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
                  className={cn(
                    'flex h-11 items-center rounded-lg text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                    collapsed
                      ? 'justify-center'
                      : 'justify-center lg:justify-start lg:gap-3 lg:px-3',
                    active
                      ? 'bg-(--admin-primary-soft) font-semibold text-(--admin-primary-dark)'
                      : 'font-medium text-muted-foreground hover:bg-(--admin-neutral-soft) hover:text-foreground'
                  )}
                >
                  <Icon className="size-5 shrink-0" strokeWidth={active ? 2.2 : 1.8} />
                  <span className={cn('truncate', collapsed ? 'hidden' : 'hidden lg:inline')}>
                    {label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <aside
      className={cn(
        'relative flex w-16 shrink-0 flex-col border-e border-dashed border-border bg-card transition-[width] duration-200 lg:w-20',
        !collapsed && 'lg:w-[264px]'
      )}
    >
      <div
        className={cn(
          'flex h-16 items-center px-3 lg:h-[72px]',
          collapsed ? 'justify-center' : 'justify-center lg:justify-start lg:px-5'
        )}
      >
        <Link
          href="/admin"
          aria-label={t('brand')}
          className="flex min-w-0 items-center gap-3 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {/* The shop's own mark, not a generic icon — the dashboard is the
              same product as the storefront. Decorative: the link already
              carries an aria-label. */}
          <img src="/brand/yasmine-logo.webp" alt="" className="size-10 shrink-0 object-contain" />
          <span
            className={cn(
              'flex min-w-0 flex-col',
              collapsed ? 'hidden' : 'hidden lg:flex'
            )}
          >
            <span className="font-(family-name:--font-betterlett) truncate text-xl leading-none">
              Yasmine
            </span>
            <span className="mt-1 flex items-center gap-1.5 text-[10px] leading-none font-semibold tracking-[0.28em] text-foreground/70 uppercase">
              <span aria-hidden="true" className="h-px w-3 bg-foreground/40" />
              Shop
              <span aria-hidden="true" className="h-px w-3 bg-foreground/40" />
            </span>
          </span>
        </Link>
      </div>

      {/* Rail-edge collapse handle (Minimal's mini-nav toggle). Hidden below
          `lg`, where the rail is already mini and the toggle has no job.
          z-50 keeps it above the translucent sticky header it overlaps. */}
      <button
        type="button"
        aria-label={t('collapse')}
        onClick={toggle}
        className="shadow-card absolute top-6 -end-3 z-50 hidden size-6 items-center justify-center rounded-full bg-card text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 lg:flex"
      >
        {collapsed ? (
          <PanelLeftOpen className="size-3.5 rtl:-scale-x-100" />
        ) : (
          <PanelLeftClose className="size-3.5 rtl:-scale-x-100" />
        )}
      </button>

      {renderBlock(t('blocks.dashboard'), DASHBOARD_ITEMS)}
      {/* Stands in for the group caption while it is hidden (mini rail). */}
      <div
        className={cn('mx-auto h-px w-6 rounded-full bg-border', collapsed ? 'block' : 'lg:hidden')}
      />
      {renderBlock(t('blocks.settings'), settingsItems)}
    </aside>
  );
}
