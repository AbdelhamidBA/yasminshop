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

// ADMIN-only profile edit (category-form-dialog idiom; the action re-checks
// requireAdmin anyway). Email is shown read-only — it is the login identity
// and updateClient deliberately cannot touch it (nor the password).
export function ClientEditDialog({
  open,
  onOpenChange,
  client
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: EditableClient | null;
}) {
  const t = useTranslations('adminClients');
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) setFieldErrors({});
  }, [open]);

  function errorLine(key: string) {
    const message = fieldErrors[key];
    if (!message) return null;
    return <p className="text-sm text-destructive">{fieldErrorText(message, t)}</p>;
  }

  function submit(formData: FormData) {
    if (!client) return;
    startTransition(async () => {
      const result = await updateClient(client.id, formData);
      if (result.ok) {
        toast.success(t('saved'));
        onOpenChange(false);
      } else {
        setFieldErrors(result.fieldErrors ?? {});
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
            <Input id="client-name" name="name" defaultValue={client?.name ?? ''} required />
            {errorLine('name')}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="client-phone">{t('phone')}</Label>
            <Input id="client-phone" name="phone" dir="ltr" defaultValue={client?.phone ?? ''} />
            {errorLine('phone')}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="client-address">{t('address')}</Label>
            <Input id="client-address" name="address" defaultValue={client?.address ?? ''} />
            {errorLine('address')}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="client-city">{t('city')}</Label>
            <Input id="client-city" name="city" defaultValue={client?.city ?? ''} />
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
