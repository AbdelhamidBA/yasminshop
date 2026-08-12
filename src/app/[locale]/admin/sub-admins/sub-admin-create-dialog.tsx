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
import {createSubAdmin} from './actions';

// ADMIN-only create form (ClientEditDialog transition/toast idiom + the
// register-form client-side password pre-check). role is never a field here —
// createSubAdmin hardcodes SUB_ADMIN server-side. The server re-validates
// everything via subAdminCreateSchema regardless.
export function SubAdminCreateDialog({
  open,
  onOpenChange
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
    // Client pre-check (register-form idiom): block an obviously short password
    // before the round-trip; the server re-validates via subAdminCreateSchema.
    const password = String(formData.get('password') ?? '');
    if (password.length < 8) {
      setFieldErrors({password: 'passwordTooShort'});
      return;
    }
    startTransition(async () => {
      const result = await createSubAdmin(formData);
      if (result.ok) {
        toast.success(t('createdToast'));
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
          <DialogTitle>{t('addTitle')}</DialogTitle>
        </DialogHeader>
        <form action={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-sub-admin-name">{t('name')}</Label>
            <Input id="new-sub-admin-name" name="name" autoComplete="off" required />
            {errorLine('name')}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-sub-admin-email">{t('email')}</Label>
            <Input
              id="new-sub-admin-email"
              name="email"
              type="email"
              dir="ltr"
              autoComplete="off"
              required
            />
            {errorLine('email')}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-sub-admin-password">{t('password')}</Label>
            <Input
              id="new-sub-admin-password"
              name="password"
              type="password"
              dir="ltr"
              autoComplete="new-password"
              required
            />
            <p className="text-xs text-muted-foreground">{t('passwordHint')}</p>
            {errorLine('password')}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={pending}>
              {t('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
