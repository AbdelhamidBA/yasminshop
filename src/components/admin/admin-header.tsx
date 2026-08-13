import {LogoutButton} from '@/components/logout-button';
import {ThemeToggle} from '@/components/theme-toggle';
import {NotificationBell} from '@/components/admin/notification-bell';
import {PushToggle} from '@/components/admin/push-toggle';
import {Avatar} from '@/components/admin/ui';
import {listNotifications, unreadCount} from '@/server/notifications';
import {getParameters} from '@/server/settings';

// Recent items surfaced in the bell popover; the full feed lives at
// /admin/notifications. Server component — it fetches the staff-shared feed and
// hands serializable props to the NotificationBell client leaf.
const BELL_LIMIT = 8;

// Minimal-UI header: no chrome band — a translucent, blurred strip that lets the
// page scroll under it, with the actions collected on the inline end.
//
// ThemeToggle / LogoutButton live in src/components and are
// shared-by-location, so they are restyled from HERE through wrapper child
// selectors (descendant specificity beats the component's own utilities)
// instead of being edited — the storefront must stay free to use them as they
// are.
const ICON_ACTION =
  '[&>button]:size-8 sm:[&>button]:size-9 [&>button]:rounded-full [&>button]:border-transparent [&>button]:text-muted-foreground [&>button]:hover:bg-(--admin-neutral-soft) [&>button]:hover:text-foreground';

const PILL_ACTION =
  '[&>button]:h-8 sm:[&>button]:h-9 [&>button]:rounded-full [&>button]:border-transparent [&>button]:px-2.5 sm:[&>button]:px-3 [&>button]:text-sm [&>button]:font-semibold [&>button]:text-muted-foreground [&>button]:hover:bg-(--admin-neutral-soft) [&>button]:hover:text-foreground';

const QUIET_LINK =
  '[&_button]:whitespace-nowrap [&_button]:text-xs [&_button]:font-medium [&_button]:text-muted-foreground [&_button]:hover:text-foreground';

export async function AdminHeader({userName}: {userName: string}) {
  const [unread, items, parameters] = await Promise.all([
    unreadCount(),
    listNotifications(BELL_LIMIT),
    getParameters()
  ]);

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-1 bg-background/75 px-4 backdrop-blur-lg lg:h-[72px] lg:px-6">
      <div className="ms-auto flex items-center gap-1">
        <NotificationBell
          unreadCount={unread}
          items={items}
          currencyLabel={parameters.currency}
        />
        <PushToggle />
        <span className={ICON_ACTION}>
          <ThemeToggle />
        </span>
        <span className={PILL_ACTION}>
        </span>
        <span aria-hidden className="mx-2 hidden h-6 w-px bg-border sm:block" />
        <span className="flex items-center gap-2.5">
          <Avatar
            name={userName}
            className="hidden size-9 bg-(--admin-primary-soft) text-(--admin-primary-dark) sm:inline-flex"
          />
          {/* The name folds away on a phone; the sign-out control never does. */}
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="hidden max-w-40 truncate text-sm font-semibold sm:block">
              {userName}
            </span>
            <span className={QUIET_LINK}>
              <LogoutButton />
            </span>
          </span>
        </span>
      </div>
    </header>
  );
}
