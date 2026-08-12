import 'server-only';
import type {Prisma} from '@prisma/client';
import {prisma} from '@/lib/db';

// Notifications are GLOBAL and staff-facing. The Phase-1 Notification model has
// NO per-recipient column, so every staff member (ADMIN + SUB_ADMIN) reads the
// SAME feed and `readAt` is a shared "seen by staff" marker: when one staff
// member marks the feed read, the badge clears for everyone. This is an
// accepted Phase-5 simplification (documented in the plan) — per-user read
// state would need a recipient join table and is out of scope. Authorization is
// the CALLER's job (requireStaff in the actions, requirePageStaff on the page);
// these functions never re-check.

// cuid charset allowlist (fix-wave scalar-guard idiom): defensive even though
// the actions guard the id first — this is a server data-access boundary.
const NOTIFICATION_ID_PATTERN = /^[a-z0-9-]{1,40}$/i;

// Same hard page cap as listOrders — keeps skip = (page-1)*pageSize from
// producing absurd Postgres offsets for URL-sourced page values.
const MAX_PAGE = 10_000;

const NOTIFICATION_SELECT = {
  id: true,
  type: true,
  payload: true,
  readAt: true,
  createdAt: true
} satisfies Prisma.NotificationSelect;

export type NotificationRow = Prisma.NotificationGetPayload<{select: typeof NOTIFICATION_SELECT}>;

// Recent-first feed for the header bell. limit is bounded defensively.
export async function listNotifications(limit: number): Promise<NotificationRow[]> {
  const take = Number.isInteger(limit) && limit >= 1 && limit <= 100 ? limit : 10;
  return prisma.notification.findMany({
    select: NOTIFICATION_SELECT,
    orderBy: [{createdAt: 'desc'}, {id: 'desc'}],
    take
  });
}

// Paginated feed for the full /admin/notifications page (AdminPagination). The
// $transaction'd count mirrors the listOrders idiom.
export async function listNotificationsPage(params: {
  page: number;
  pageSize: number;
}): Promise<{notifications: NotificationRow[]; total: number}> {
  const page =
    Number.isSafeInteger(params.page) && params.page >= 1 && params.page <= MAX_PAGE
      ? params.page
      : 1;
  const pageSize =
    Number.isInteger(params.pageSize) && params.pageSize >= 1 && params.pageSize <= 100
      ? params.pageSize
      : 20;
  const [notifications, total] = await prisma.$transaction([
    prisma.notification.findMany({
      select: NOTIFICATION_SELECT,
      orderBy: [{createdAt: 'desc'}, {id: 'desc'}],
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.notification.count()
  ]);
  return {notifications, total};
}

export async function unreadCount(): Promise<number> {
  return prisma.notification.count({where: {readAt: null}});
}

export async function markAllRead(): Promise<void> {
  await prisma.notification.updateMany({
    where: {readAt: null},
    data: {readAt: new Date()}
  });
}

export async function markRead(id: string): Promise<void> {
  if (typeof id !== 'string' || !NOTIFICATION_ID_PATTERN.test(id)) return;
  // Only flips unread → read (WHERE readAt: null) so a re-click is a no-op and
  // the original "seen" timestamp is preserved.
  await prisma.notification.updateMany({
    where: {id, readAt: null},
    data: {readAt: new Date()}
  });
}
