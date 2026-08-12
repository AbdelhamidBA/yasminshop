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
import {cn} from '@/lib/utils';

const STORAGE_KEY = 'admin-sidebar-collapsed';

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

  function renderBlock(title: string, items: NavItem[]) {
    return (
      <div className="px-2 py-3">
        {!collapsed && (
          <p className="px-2 pb-2 text-xs font-semibold uppercase text-muted-foreground">
            {title}
          </p>
        )}
        <ul className="flex flex-col gap-1">
          {items.map((item) => {
            const active =
              item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  title={t(`nav.${item.labelKey}`)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors',
                    active
                      ? 'bg-primary/10 font-medium text-primary'
                      : 'text-foreground hover:bg-accent',
                    collapsed && 'justify-center'
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {!collapsed && <span className="truncate">{t(`nav.${item.labelKey}`)}</span>}
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
        'flex shrink-0 flex-col border-e bg-background transition-all',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      <div
        className={cn(
          'flex h-16 items-center gap-2 border-b px-3',
          collapsed ? 'justify-center' : 'justify-between'
        )}
      >
        {!collapsed && (
          <Link href="/admin" title={t('brand')} className="flex min-w-0 items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ShoppingBag className="size-4" />
            </span>
            <span className="truncate font-heading text-base font-semibold">{t('brand')}</span>
          </Link>
        )}
        <button
          type="button"
          aria-label={t('collapse')}
          onClick={toggle}
          className="flex size-8 shrink-0 items-center justify-center rounded-md hover:bg-accent"
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </button>
      </div>
      {renderBlock(t('blocks.dashboard'), DASHBOARD_ITEMS)}
      {renderBlock(t('blocks.settings'), settingsItems)}
    </aside>
  );
}
