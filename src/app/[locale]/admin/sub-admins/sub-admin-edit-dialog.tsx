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
import {updateSubAdmin} from './actions';

export type EditableSubAdmin = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
};

// ADMIN-only profile edit (ClientEditDialog idiom; the action re-checks
// requireAdmin anyway). Email is shown read-only — it is the login identity and
// updateSubAdmin deliberately cannot touch it (nor the password nor the role).
export function SubAdminEditDialog({
  open,
  onOpenChange,
  subAdmin
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subAdmin: EditableSubAdmin | null;
}) {
  const t = useTranslations('subAdmins');
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
    if (!subAdmin) return;
    startTransition(async () => {
      const result = await updateSubAdmin(subAdmin.id, formData);
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
        <form action={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="sub-admin-email">{t('email')}</Label>
            <Input id="sub-admin-email" dir="ltr" value={subAdmin?.email ?? ''} disabled readOnly />
            <p className="text-xs text-muted-foreground">{t('emailReadOnly')}</p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="sub-admin-name">{t('name')}</Label>
            <Input id="sub-admin-name" name="name" defaultValue={subAdmin?.name ?? ''} required />
            {errorLine('name')}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="sub-admin-phone">{t('phone')}</Label>
            <Input
              id="sub-admin-phone"
              name="phone"
              dir="ltr"
              defaultValue={subAdmin?.phone ?? ''}
            />
            {errorLine('phone')}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={pending}>
              {t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
