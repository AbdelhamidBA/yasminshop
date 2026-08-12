import {LanguageSwitcher} from '@/components/language-switcher';
import {LogoutButton} from '@/components/logout-button';
import {ThemeToggle} from '@/components/theme-toggle';
import {NotificationBell} from '@/components/admin/notification-bell';
import {listNotifications, unreadCount} from '@/server/notifications';
import {getParameters} from '@/server/settings';

// Recent items surfaced in the bell popover; the full feed lives at
// /admin/notifications. Server component — it fetches the staff-shared feed and
// hands serializable props to the NotificationBell client leaf.
const BELL_LIMIT = 8;

export async function AdminHeader({userName}: {userName: string}) {
  const [unread, items, parameters] = await Promise.all([
    unreadCount(),
    listNotifications(BELL_LIMIT),
    getParameters()
  ]);

  return (
    <header className="flex h-16 items-center gap-2 border-b px-6">
      <div className="ms-auto flex items-center gap-2">
        <NotificationBell
          unreadCount={unread}
          items={items}
          currencyLabel={parameters.currency}
        />
        <LanguageSwitcher />
        <ThemeToggle />
        <span className="ms-2 text-sm font-medium">{userName}</span>
        <LogoutButton />
      </div>
    </header>
  );
}
