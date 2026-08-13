import {useTranslations} from 'next-intl';
import type {OrderStatus} from '@/lib/orders';
import {StatusLabel, type AdminTone} from './ui';

// Shared order-status chip. Minimal UI never fills a status solid — it uses the
// soft Label (semantic colour at 16% behind its own solid ink), which is the
// StatusLabel primitive. Tones follow the dashboard's semantic mapping:
// PENDING → warning, CONFIRMED → info, DELIVERED → success, CANCELED → error.
// Defined ONCE here; admin list/detail and the storefront's My Orders all
// import it. The label TEXT is unchanged (adminOrders.status.*). No
// 'use client' so it renders from both server and client trees.
const STATUS_TONE: Record<OrderStatus, AdminTone> = {
  PENDING: 'warning',
  CONFIRMED: 'info',
  DELIVERED: 'success',
  CANCELED: 'error'
};

export function OrderStatusBadge({status}: {status: OrderStatus}) {
  const t = useTranslations('adminOrders.status');

  return <StatusLabel tone={STATUS_TONE[status]}>{t(status as never)}</StatusLabel>;
}
