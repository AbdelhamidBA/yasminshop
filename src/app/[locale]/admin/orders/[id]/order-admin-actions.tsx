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

// Inverse of the placeOrder fold (`${address}, ${city}`): the last ", "
// segment is the best-effort city default; anything before it is the address.
// No comma → whole string as address, city left for the admin to fill.
function splitAddress(customerAddress: string): {address: string; city: string} {
  const idx = customerAddress.lastIndexOf(', ');
  if (idx === -1) return {address: customerAddress, city: ''};
  return {address: customerAddress.slice(0, idx), city: customerAddress.slice(idx + 2)};
}

// ADMIN-only controls (the server page renders this only for ADMIN; the
// actions re-check requireAdmin anyway). Archived orders are view-only:
// restore is the single affordance — no edit, no archive.
export function OrderAdminActions({order}: {order: EditableOrderCustomer}) {
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
        toast.success(t('archivedToast'));
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
        toast.success(t('restoredToast'));
        router.refresh();
      } else {
        toast.error(t(`errors.${result.error}` as never));
      }
    });
  }

  if (order.archived) {
    return (
      <Button variant="outline" disabled={pending} onClick={runRestore}>
        {t('restore')}
      </Button>
    );
  }

  return (
    <>
      <Button variant="outline" disabled={pending} onClick={() => setEditing(true)}>
        {t('editCustomer')}
      </Button>
      <Button variant="destructive" disabled={pending} onClick={() => setConfirmArchive(true)}>
        {t('archive')}
      </Button>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('editCustomer')}</DialogTitle>
          </DialogHeader>
          <form action={submit} className="flex flex-col gap-4">
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
              <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={pending}>
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
