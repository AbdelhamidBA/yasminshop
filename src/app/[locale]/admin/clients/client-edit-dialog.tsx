'use client';

import {useEffect, useState, useTransition} from 'react';
import {useTranslations} from 'next-intl';
import {toast} from 'sonner';
import {Button} from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {fieldErrorText} from '@/lib/field-error';
import {updateClient} from './actions';

export type EditableClient = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
};

// Staff profile edit — ADMIN and SUB_ADMIN alike (category-form-dialog idiom;
// updateClient re-checks requireStaff anyway). Email is shown read-only — it is
// the login identity and updateClient deliberately cannot touch it (nor the
// password), so neither role can take an account over from here.
//
// `onSaved` exists for the callers that are NOT the clients list: updateClient
// revalidates the list route only, so the profile page passes router.refresh()
// to see its own values update (OrderAdminActions idiom).
export function ClientEditDialog({
  open,
  onOpenChange,
  client,
  onSaved
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: EditableClient | null;
  onSaved?: () => void;
}) {
  const t = useTranslations('adminClients');
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // React 19 resets an uncontrolled <form action={...}> once the action
  // settles — including when it FAILS validation, which wiped everything that
  // had just been typed. Replay the submitted values as the new defaults;
  // `entryKey` remounts just those inputs (product-form idiom).
  const [entered, setEntered] = useState<Record<string, string>>({});
  const [entryKey, setEntryKey] = useState(0);
  const initial = (field: string, fallback: string | number | null | undefined) =>
    entered[field] ?? (fallback === null || fallback === undefined ? '' : String(fallback));

  useEffect(() => {
    if (open) {
      setFieldErrors({});
      // A fresh open must show the row's own values, never the previous
      // attempt's replayed text.
      setEntered({});
    }
  }, [open]);

  function errorLine(key: string) {
    const message = fieldErrors[key];
    if (!message) return null;
    return <p className="text-sm text-destructive">{fieldErrorText(message, t)}</p>;
  }

  function submit(formData: FormData) {
    // Snapshot what was typed BEFORE the early return below: React resets the
    // form as soon as this action returns, whatever the outcome.
    const typed: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      if (typeof value === 'string') typed[key] = value;
    }
    const restoreTypedValues = () => {
      setEntered(typed);
      setEntryKey((key) => key + 1);
    };

    if (!client) {
      restoreTypedValues();
      return;
    }
    startTransition(async () => {
      const result = await updateClient(client.id, formData);
      if (result.ok) {
        toast.success(t('saved'));
        onOpenChange(false);
        onSaved?.();
      } else {
        setFieldErrors(result.fieldErrors ?? {});
        restoreTypedValues();
        toast.error(t(`errors.${result.error}` as never));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('editTitle')}</DialogTitle>
        </DialogHeader>
        <form action={submit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="client-email">{t('email')}</Label>
            <Input id="client-email" dir="ltr" value={client?.email ?? ''} disabled readOnly />
            <p className="text-xs text-muted-foreground">{t('emailReadOnly')}</p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="client-name">{t('name')}</Label>
            <Input
              id="client-name"
              name="name"
              required
              key={`name-${entryKey}`}
              defaultValue={initial('name', client?.name)}
            />
            {errorLine('name')}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="client-phone">{t('phone')}</Label>
            <Input
              id="client-phone"
              name="phone"
              dir="ltr"
              key={`phone-${entryKey}`}
              defaultValue={initial('phone', client?.phone)}
            />
            {errorLine('phone')}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="client-address">{t('address')}</Label>
            <Input
              id="client-address"
              name="address"
              key={`address-${entryKey}`}
              defaultValue={initial('address', client?.address)}
            />
            {errorLine('address')}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="client-city">{t('city')}</Label>
            <Input
              id="client-city"
              name="city"
              key={`city-${entryKey}`}
              defaultValue={initial('city', client?.city)}
            />
            {errorLine('city')}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="px-4"
              onClick={() => onOpenChange(false)}
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
  );
}
