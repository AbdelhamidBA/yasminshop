'use server';

import {revalidatePath} from 'next/cache';
import {failure, success, type ActionResult} from '@/lib/action-result';
import {AuthzError} from '@/lib/authz';
import {requireStaff} from '@/server/authz';
import {markAllRead, markRead} from '@/server/notifications';

// Notification ids are cuids; same charset allowlist as every other
// client-supplied id (Phase 2 fix-wave scalar-guard idiom).
const ID_PATTERN = /^[a-z0-9-]{1,40}$/i;
const PATH = '/[locale]/admin/notifications';

// Any staff member may read the shared feed (requireStaff) — notifications are
// global and admin-facing (see src/server/notifications.ts). The header bell
// also calls router.refresh() after these actions, which re-runs the admin
// header server component and refreshes the badge on every admin page.
export async function markAllNotificationsRead(): Promise<ActionResult> {
  try {
    await requireStaff();
    await markAllRead();
    revalidatePath(PATH, 'page');
    return success(undefined);
  } catch (error) {
    if (error instanceof AuthzError) return failure('forbidden');
    throw error;
  }
}

export async function markNotificationRead(id: string): Promise<ActionResult> {
  try {
    await requireStaff();
    if (typeof id !== 'string' || !ID_PATTERN.test(id)) return failure('notFound');
    await markRead(id);
    revalidatePath(PATH, 'page');
    return success(undefined);
  } catch (error) {
    if (error instanceof AuthzError) return failure('forbidden');
    throw error;
  }
}
