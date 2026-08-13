'use client';

import {useState, useTransition} from 'react';
import {useTranslations} from 'next-intl';
import {toast} from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import {Button} from '@/components/ui/button';
import {useRouter} from '@/i18n/navigation';
import {ALLOWED_TRANSITIONS, stockDelta, type OrderStatus} from '@/lib/orders';
import {changeOrderStatus} from '../actions';

// Allowed-next transition buttons (requireStaff-backed action: sub-admin sees
// and uses these). Only CANCELED asks for confirmation — it is terminal and,
// from CONFIRMED, restocks quantities; CONFIRMED/DELIVERED apply directly.
export function StatusControl({orderId, status}: {orderId: string; status: OrderStatus}) {
  const t = useTranslations('adminOrders');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmCancel, setConfirmCancel] = useState(false);

  const targets = ALLOWED_TRANSITIONS[status];
  if (targets.length === 0) return null;

  function run(to: OrderStatus) {
    startTransition(async () => {
      const result = await changeOrderStatus(orderId, to);
      if (result.ok) {
        // The one fact the operator cannot see from the badge: what the
        // transition did to stock. stockDelta is the SAME pure rule the action
        // applied server-side, so the description can never drift from reality.
        const delta = stockDelta(status, to);
        toast.success(t('statusChanged'), {
          description:
            delta === 'decrement'
              ? t('statusChangedStockOut')
              : delta === 'restock'
                ? t('statusChangedStockIn')
                : undefined
        });
        // changeOrderStatus revalidates the list route; refresh re-renders
        // this detail route so badge and buttons follow the new status.
        router.refresh();
      } else {
        toast.error(t(`errors.${result.error}` as never));
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {targets.map((to) =>
        to === 'CANCELED' ? (
          <Button
            key={to}
            variant="destructive"
            className="h-11"
            disabled={pending}
            onClick={() => setConfirmCancel(true)}
          >
            {t(`transitionTo.${to}` as never)}
          </Button>
        ) : (
          <Button
            key={to}
            className="h-11 shadow-[var(--shadow-primary)]"
            disabled={pending}
            onClick={() => run(to)}
          >
            {t(`transitionTo.${to}` as never)}
          </Button>
        )
      )}

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent className="theme-minimal">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirmCancelTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('confirmCancelBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                run('CANCELED');
                setConfirmCancel(false);
              }}
            >
              {t('confirmCancelAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
