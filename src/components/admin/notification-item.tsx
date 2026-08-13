'use client';

import {useTransition} from 'react';
import {ShoppingBag, Sparkles} from 'lucide-react';
import {useLocale, useTranslations} from 'next-intl';
import {markNotificationRead} from '@/app/[locale]/admin/notifications/actions';
import {IconBox} from '@/components/admin/ui';
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
//
// Minimal-UI shape: a tinted icon box, the message on one line (kept as a
// single text node — the e2e suite matches it with a regex), the timestamp
// muted beneath, and an unread dot on the inline end.
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
        'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50',
        unread && 'bg-(--admin-neutral-soft)'
      )}
    >
      <IconBox tone={newOrder ? 'primary' : 'neutral'} className="size-10 rounded-full">
        {newOrder ? (
          <ShoppingBag className="size-4" strokeWidth={2} />
        ) : (
          <Sparkles className="size-4" strokeWidth={2} />
        )}
      </IconBox>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn('text-sm', unread ? 'font-semibold' : 'font-medium')}>{message}</span>
        <span className="text-xs text-muted-foreground">
          {dateFormatter.format(item.createdAt)}
        </span>
      </span>
      {unread && (
        <span aria-hidden className="size-2 shrink-0 rounded-full bg-primary" />
      )}
    </Link>
  );
}
