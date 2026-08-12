import {getTranslations} from 'next-intl/server';
import {AdminPagination} from '@/components/admin/admin-pagination';
import {MarkAllReadButton} from '@/components/admin/mark-all-read-button';
import {NotificationItem} from '@/components/admin/notification-item';
import {requirePageStaff} from '@/server/authz';
import {listNotificationsPage, unreadCount} from '@/server/notifications';
import {getParameters} from '@/server/settings';

const PAGE_SIZE = 20;

// Full notification feed (requirePageStaff: both ADMIN + SUB_ADMIN). Global,
// staff-shared feed (see src/server/notifications.ts) — same list the header
// bell surfaces, paginated. The bell's "view all" link points here.
export default async function NotificationsPage({
  searchParams
}: {
  searchParams: Promise<{page?: string}>;
}) {
  await requirePageStaff();
  const params = await searchParams;
  const page =
    typeof params.page === 'string' && /^\d{1,4}$/.test(params.page)
      ? Number.parseInt(params.page, 10)
      : 1;

  const [t, parameters, unread, {notifications, total}] = await Promise.all([
    getTranslations('notifications'),
    getParameters(),
    unreadCount(),
    listNotificationsPage({page, pageSize: PAGE_SIZE})
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <MarkAllReadButton disabled={unread === 0} />
      </div>

      {notifications.length === 0 ? (
        <p className="text-muted-foreground">{t('empty')}</p>
      ) : (
        <div className="flex flex-col gap-1 rounded-md border p-1">
          {notifications.map((item) => (
            <NotificationItem key={item.id} item={item} currencyLabel={parameters.currency} />
          ))}
        </div>
      )}

      <AdminPagination
        basePath="/admin/notifications"
        page={page}
        totalPages={Math.ceil(total / PAGE_SIZE)}
        params={{}}
        prevLabel={t('prev')}
        nextLabel={t('next')}
      />
    </div>
  );
}
