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
            className="relative flex size-9 items-center justify-center rounded-md border hover:bg-accent"
          >
            <Bell className="size-4" />
            {unreadCount > 0 && (
              <span
                aria-hidden
                className="absolute -top-1 -end-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground"
              >
                {badge}
              </span>
            )}
          </button>
        }
      />
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={8} className="isolate z-50 outline-none">
          <Popover.Popup className="flex w-80 max-w-[calc(100vw-2rem)] origin-(--transform-origin) flex-col rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
              <span className="text-sm font-semibold">{t('heading')}</span>
              <MarkAllReadButton variant="ghost" size="xs" disabled={unreadCount === 0} />
            </div>
            <div className="flex max-h-80 flex-col gap-0.5 overflow-y-auto p-1">
              {items.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t('empty')}</p>
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
            <div className="border-t p-1">
              <Link
                href="/admin/notifications"
                onClick={() => setOpen(false)}
                className="block rounded-md px-3 py-2 text-center text-sm font-medium hover:bg-accent"
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
