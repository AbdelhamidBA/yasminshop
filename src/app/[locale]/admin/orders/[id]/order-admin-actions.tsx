'use client';

import {useEffect, useState, useTransition} from 'react';
import {useTranslations} from 'next-intl';
import {toast} from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import {Button} from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Textarea} from '@/components/ui/textarea';
import {useRouter} from '@/i18n/navigation';
import {splitAddress} from '@/lib/address';
import {fieldErrorText} from '@/lib/field-error';
import {archiveOrder, restoreOrder, updateOrderCustomer} from '../actions';

export type EditableOrderCustomer = {
  id: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  notes: string | null;
  archived: boolean;
};

// splitAddress (the inverse of createOrderCore's `${address}, ${city}` fold)
// moved to src/lib/address.ts when the client-profile backfill needed the same
// operation — one definition, unit-tested, instead of two that can drift.

// Staff controls, split by role. Editing the customer details is open to both
// (updateOrderCustomer re-checks requireStaff); archive/restore is ADMIN-only,
// so `canArchive` hides those two buttons from a SUB_ADMIN — the actions
// re-check requireAdmin regardless. Archived orders are view-only: restore is
// the single affordance — no edit, no archive — which leaves a SUB_ADMIN
// nothing to render on one.
export function OrderAdminActions({
  order,
  canArchive
}: {
  order: EditableOrderCustomer;
  canArchive: boolean;
}) {
  const t = useTranslations('adminOrders');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (editing) setFieldErrors({});
  }, [editing]);

  const defaults = splitAddress(order.customerAddress);

  function errorLine(key: string) {
    const message = fieldErrors[key];
    if (!message) return null;
    return <p className="text-sm text-destructive">{fieldErrorText(message, t)}</p>;
  }

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await updateOrderCustomer(order.id, formData);
      if (result.ok) {
        toast.success(t('saved'));
        setEditing(false);
        router.refresh();
      } else {
        setFieldErrors(result.fieldErrors ?? {});
        toast.error(t(`errors.${result.error}` as never));
      }
    });
  }

  function runArchive() {
    startTransition(async () => {
      const result = await archiveOrder(order.id);
      if (result.ok) {
        // Hiding a record is a state change, not an achievement — info, and the
        // description names where the order went (the list's default filter).
        toast.info(t('archivedToast'), {description: t('archivedDescription')});
        router.refresh();
      } else {
        toast.error(t(`errors.${result.error}` as never));
      }
    });
  }

  function runRestore() {
    startTransition(async () => {
      const result = await restoreOrder(order.id);
      if (result.ok) {
        toast.success(t('restoredToast'), {description: t('restoredDescription')});
        router.refresh();
      } else {
        toast.error(t(`errors.${result.error}` as never));
      }
    });
  }

  if (order.archived) {
    if (!canArchive) return null;
    return (
      <Button
        variant="ghost"
        className="h-10 bg-(--admin-neutral-soft) px-4"
        disabled={pending}
        onClick={runRestore}
      >
        {t('restore')}
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="ghost"
        className="h-10 bg-(--admin-neutral-soft) px-4"
        disabled={pending}
        onClick={() => setEditing(true)}
      >
        {t('editCustomer')}
      </Button>
      {canArchive && (
        <Button
          variant="destructive"
          className="h-10 px-4"
          disabled={pending}
          onClick={() => setConfirmArchive(true)}
        >
          {t('archive')}
        </Button>
      )}

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="theme-minimal">
          <DialogHeader>
            <DialogTitle>{t('editCustomer')}</DialogTitle>
          </DialogHeader>
          <form action={submit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">{t('name')}</Label>
              <Input id="name" name="name" defaultValue={order.customerName} required />
              {errorLine('name')}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="phone">{t('phone')}</Label>
              <Input id="phone" name="phone" dir="ltr" defaultValue={order.customerPhone} required />
              {errorLine('phone')}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="address">{t('address')}</Label>
              <Input id="address" name="address" defaultValue={defaults.address} required />
              {errorLine('address')}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="city">{t('city')}</Label>
              <Input id="city" name="city" defaultValue={defaults.city} required />
              {errorLine('city')}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="notes">{t('notes')}</Label>
              <Textarea id="notes" name="notes" defaultValue={order.notes ?? ''} />
              {errorLine('notes')}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="px-4"
                onClick={() => setEditing(false)}
              >
                {t('cancel')}
              </Button>
              <Button type="submit" size="lg" className="px-4" disabled={pending}>
                {t('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmArchive} onOpenChange={setConfirmArchive}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirmArchiveTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('confirmArchiveBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                runArchive();
                setConfirmArchive(false);
              }}
            >
              {t('archive')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
