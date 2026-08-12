'use client';

import {useTransition} from 'react';
import {useTranslations} from 'next-intl';
import {toast} from 'sonner';
import {markAllNotificationsRead} from '@/app/[locale]/admin/notifications/actions';
import {Button} from '@/components/ui/button';
import {useRouter} from '@/i18n/navigation';

// Shared "mark all read" control for the bell popover and the full page. On
// success it calls router.refresh() so the admin header server component re-runs
// and the badge clears across every admin page (the bell is global).
export function MarkAllReadButton({
  disabled,
  variant = 'outline',
  size = 'sm'
}: {
  disabled?: boolean;
  variant?: 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'xs';
}) {
  const t = useTranslations('notifications');
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const result = await markAllNotificationsRead();
      if (result.ok) {
        toast.success(t('markedAllReadToast'));
        router.refresh();
      } else {
        toast.error(t(`errors.${result.error}` as never));
      }
    });
  }

  return (
    <Button variant={variant} size={size} disabled={disabled || pending} onClick={run}>
      {t('markAllRead')}
    </Button>
  );
}
