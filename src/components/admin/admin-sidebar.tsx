'use client';

import {useEffect, useState} from 'react';
import {PanelLeftClose, PanelLeftOpen} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {Link} from '@/i18n/navigation';
import {AdminNav} from '@/components/admin/admin-nav';
import {cn} from '@/lib/utils';

const STORAGE_KEY = 'admin-sidebar-collapsed';

// Minimal-UI nav rail: paper-white, separated from the page by a dashed
// hairline rather than a solid rule, nav grouped under Overline captions, and
// an active item that reads as a soft primary wash behind primary ink.
//
// DESKTOP ONLY (`lg`). Below that the rail is replaced outright by the header's
// burger + drawer (admin-mobile-nav.tsx) — a mini icon rail was still eating a
// sixth of a phone screen and offered no labels. Both shells render the same
// <AdminNav>, so the destinations can never drift.
//
// The rail is STICKY at the top of the flex row and exactly one viewport tall,
// so the document scroll moves only the page content past it: navigation is
// always reachable without a second scroll container (no nested scrollport, no
// double scrollbar). Its own nav strip scrolls internally when the list is
// taller than the viewport.
//
// z-50 (not the header's z-40): `position: sticky` creates a stacking context,
// so the collapse handle — which overhangs into the header band — can no longer
// out-stack the translucent header from the inside.

export function AdminSidebar({isAdmin}: {isAdmin: boolean}) {
  const t = useTranslations('admin');
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

  return (
    <aside
      className={cn(
        'sticky top-0 z-50 hidden h-svh shrink-0 flex-col self-start border-e border-dashed border-border bg-card transition-[width] duration-200 lg:flex',
        collapsed ? 'w-20' : 'w-[264px]'
      )}
    >
      <div
        className={cn(
          'flex h-[72px] shrink-0 items-center px-3',
          collapsed ? 'justify-center' : 'justify-start px-5'
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
          <span className={cn('flex min-w-0 flex-col', collapsed && 'hidden')}>
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

      {/* Rail-edge collapse handle (Minimal's mini-nav toggle). It sits on the
          aside, NOT inside the scrolling nav strip, so the internal scroll can
          never clip it. */}
      <button
        type="button"
        aria-label={t('collapse')}
        aria-pressed={collapsed}
        onClick={toggle}
        className="shadow-card absolute top-6 -end-3 z-50 flex size-6 items-center justify-center rounded-full bg-card text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {collapsed ? (
          <PanelLeftOpen className="size-3.5 rtl:-scale-x-100" />
        ) : (
          <PanelLeftClose className="size-3.5 rtl:-scale-x-100" />
        )}
      </button>

      {/* The only scrollport in the shell besides the document: a nav list
          longer than the viewport stays reachable. */}
      <nav aria-label={t('navLabel')} className="min-h-0 flex-1 overflow-y-auto pb-4">
        <AdminNav isAdmin={isAdmin} collapsed={collapsed} />
      </nav>
    </aside>
  );
}
