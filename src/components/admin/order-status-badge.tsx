import {useTranslations} from 'next-intl';
import {Badge} from '@/components/ui/badge';
import type {OrderStatus} from '@/lib/orders';
import {cn} from '@/lib/utils';

// Shared status pill (plan Global Constraints palette, reference image):
// PENDING amber, CONFIRMED blue, DELIVERED green, CANCELED red — theme-safe
// via the bg-<color>-500/15 + dark:text-<color>-400 pattern. Defined ONCE here;
// admin list/detail (and later My Orders) all import it. No 'use client' so it
// renders from both server and client trees.
const STATUS_CLASSES: Record<OrderStatus, string> = {
  PENDING: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  CONFIRMED: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  DELIVERED: 'bg-green-500/15 text-green-600 dark:text-green-400',
  CANCELED: 'bg-red-500/15 text-red-600 dark:text-red-400'
};

export function OrderStatusBadge({status}: {status: OrderStatus}) {
  const t = useTranslations('adminOrders.status');

  return <Badge className={cn(STATUS_CLASSES[status])}>{t(status as never)}</Badge>;
}
