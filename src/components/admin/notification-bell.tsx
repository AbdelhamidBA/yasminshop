'use client';

import {useState} from 'react';
import {Popover} from '@base-ui/react/popover';
import {Bell} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {Link} from '@/i18n/navigation';
import type {NotificationRow} from '@/server/notifications';
import {MarkAllReadButton} from './mark-all-read-button';
import {NotificationItem} from './notification-item';

// Header notification bell. `unreadCount` and `items` are server-passed (fetched
// in the AdminHeader server component) and are the single source of truth — the
// badge is driven straight from `unreadCount`, no local mirror to drift.
// Opening the popover (and every mark-read action) calls router.refresh(), which
// re-runs AdminHeader and streams a fresh count + item list back into this leaf.
// Real-time delivery is push's job (Task 5); this channel refreshes on
// open / navigation / mark-read only.
//
// The badge is the ONLY aria-hidden span inside the trigger button (the e2e
// suite locates it as `bell.locator('span[aria-hidden="true"]')`) — do not add
// another decorative span in there.
export function NotificationBell({
  unreadCount,
  items,
  currencyLabel
}: {
  unreadCount: number;
  items: NotificationRow[];
  currencyLabel: string;
}) {
  const t = useTranslations('notifications');
  const [open, setOpen] = useState(false);

  // `items`/`unreadCount` are already fresh: AdminHeader (a server component)
  // re-fetches them on every navigation into an admin route. We deliberately do
  // NOT router.refresh() on open — a server round-trip mid-open re-streams the
  // header and can transiently disrupt the just-opened popup (and flickers its
  // content for the user). Staleness is bounded to "a new order arrived while
  // sitting on one page without navigating", which push delivery (Task 5)
  // covers; mark-all-read still revalidates to drop the badge to 0.
  function handleOpenChange(next: boolean) {
    setOpen(next);
  }

  const badge = unreadCount > 9 ? '9+' : String(unreadCount);

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger
        render={
          <button
            type="button"
            aria-label={t('open')}
            className="relative flex size-8 items-center justify-center rounded-full text-muted-foreground sm:size-9 transition-colors outline-none hover:bg-(--admin-neutral-soft) hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:bg-(--admin-neutral-soft) data-popup-open:text-foreground"
          >
            <Bell className="size-5" strokeWidth={1.8} />
            {unreadCount > 0 && (
              <span
                aria-hidden
                className="absolute -top-0.5 -end-0.5 flex min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-[18px] font-bold text-primary-foreground"
              >
                {badge}
              </span>
            )}
          </button>
        }
      />
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={10} className="isolate z-50 outline-none">
          {/* theme-minimal: the popup portals to <body>, outside the admin
              subtree, so it carries the dashboard palette itself. */}
          <Popover.Popup className="theme-minimal shadow-float flex w-80 max-w-[calc(100vw-2rem)] origin-(--transform-origin) flex-col rounded-2xl bg-popover text-popover-foreground duration-150 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <div className="flex items-center justify-between gap-2 border-b border-dashed border-border px-4 py-3">
              <span className="font-heading text-base font-bold">{t('heading')}</span>
              <MarkAllReadButton variant="ghost" size="xs" disabled={unreadCount === 0} />
            </div>
            <div className="flex max-h-80 flex-col gap-0.5 overflow-y-auto p-2">
              {items.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">{t('empty')}</p>
              ) : (
                items.map((item) => (
                  <NotificationItem
                    key={item.id}
                    item={item}
                    currencyLabel={currencyLabel}
                    onNavigate={() => setOpen(false)}
                  />
                ))
              )}
            </div>
            <div className="border-t border-dashed border-border p-2">
              <Link
                href="/admin/notifications"
                onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-2 text-center text-sm font-semibold text-(--admin-primary-dark) transition-colors outline-none hover:bg-(--admin-primary-soft) focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {t('viewAll')}
              </Link>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
