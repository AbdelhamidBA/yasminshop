'use client';

import {useTransition} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {markNotificationRead} from '@/app/[locale]/admin/notifications/actions';
import {Link} from '@/i18n/navigation';
import {formatMillimes} from '@/lib/money';
import {NEW_ORDER, parseNewOrderPayload} from '@/lib/notifications';
import {cn} from '@/lib/utils';
import type {NotificationRow} from '@/server/notifications';

// One notification row, shared by the header bell and the full page. NEW_ORDER
// links to its order detail (/admin/orders/[orderId]); anything unrecognised
// falls back to a generic label and links to the notifications page. Clicking
// an unread row marks THIS one read (best-effort) and then the Link navigates —
// the destination re-renders the admin header with a fresh unread count, so no
// explicit refresh is needed here. Real-time delivery is push's job (Task 5);
// this channel updates on navigation / popover-open / mark-read only.
export function NotificationItem({
  item,
  currencyLabel,
  onNavigate
}: {
  item: NotificationRow;
  currencyLabel: string;
  onNavigate?: () => void;
}) {
  const t = useTranslations('notifications');
  const locale = useLocale();
  const [, startTransition] = useTransition();

  const dateFormatter = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-TN' : 'fr-TN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  const unread = item.readAt === null;
  const newOrder = item.type === NEW_ORDER ? parseNewOrderPayload(item.payload) : null;
  const href = newOrder ? `/admin/orders/${newOrder.orderId}` : '/admin/notifications';
  const message = newOrder
    ? t('newOrder', {
        number: String(newOrder.number),
        total: `${formatMillimes(newOrder.totalMillimes)} ${currencyLabel}`
      })
    : t('generic');

  function handleClick() {
    // Best-effort mark-read; the Link navigation refreshes the header count.
    if (unread) {
      startTransition(async () => {
        await markNotificationRead(item.id);
      });
    }
    onNavigate?.();
  }

  return (
    <Link
      href={href}
      onClick={handleClick}
      className={cn(
        'flex flex-col gap-1 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent',
        unread && 'bg-accent/40'
      )}
    >
      <span className="flex items-center gap-2">
        {unread && <span aria-hidden className="size-2 shrink-0 rounded-full bg-primary" />}
        <span className={cn('font-medium', !unread && 'ps-4')}>{message}</span>
      </span>
      <span className="ps-4 text-xs text-muted-foreground">
        {dateFormatter.format(item.createdAt)}
      </span>
    </Link>
  );
}
