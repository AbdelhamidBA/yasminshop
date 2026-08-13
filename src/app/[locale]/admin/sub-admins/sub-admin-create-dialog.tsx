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
  // React 19 resets an uncontrolled <form action={...}> once the action
  // settles — including when it FAILS validation, which wiped the name and
  // e-mail that were just typed. Replay them as the new defaults; `entryKey`
  // remounts just those inputs (product-form idiom). The PASSWORD is
  // deliberately NOT replayed — it must come back empty.
  const [entered, setEntered] = useState<Record<string, string>>({});
  const [entryKey, setEntryKey] = useState(0);
  const initial = (field: string) => entered[field] ?? '';

  useEffect(() => {
    if (open) {
      setFieldErrors({});
      // A fresh open must start from an empty form, never the previous
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
    // form as soon as this action returns, whatever the outcome, so the short-
    // password guard has to put the values back too. The password itself is
    // dropped from the snapshot — it is never replayed.
    const typed: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      if (typeof value === 'string' && key !== 'password') typed[key] = value;
    }
    const restoreTypedValues = () => {
      setEntered(typed);
      setEntryKey((key) => key + 1);
    };

    // Client pre-check (register-form idiom): block an obviously short password
    // before the round-trip; the server re-validates via subAdminCreateSchema.
    const password = String(formData.get('password') ?? '');
    if (password.length < 8) {
      setFieldErrors({password: 'passwordTooShort'});
      restoreTypedValues();
      return;
    }
    startTransition(async () => {
      const result = await createSubAdmin(formData);
      if (result.ok) {
        // The account's exact reach (server-enforced SUB_ADMIN scope): order
        // status transitions and product quantity, nothing else.
        toast.success(t('createdToast'), {description: t('createdDescription')});
        onOpenChange(false);
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
          <DialogTitle>{t('addTitle')}</DialogTitle>
        </DialogHeader>
        <form action={submit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-sub-admin-name">{t('name')}</Label>
            <Input
              id="new-sub-admin-name"
              name="name"
              autoComplete="off"
              required
              key={`name-${entryKey}`}
              defaultValue={initial('name')}
            />
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
              key={`email-${entryKey}`}
              defaultValue={initial('email')}
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
              {t('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
