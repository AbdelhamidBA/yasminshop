'use client';

import {useState, useTransition} from 'react';
import {CheckCircle2} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {toast} from 'sonner';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Panel, SoftNote} from '@/components/admin/form';
import {fieldErrorText} from '@/lib/field-error';
import {changeOwnPassword, endSessionAfterPasswordChange} from './actions';

/**
 * Change-my-password form for the staff profile.
 *
 * NOTHING IS REPLAYED ON FAILURE. Every other form in this project restores
 * what was typed when the action rejects it, because React 19 clears an
 * uncontrolled <form action> once the action settles. Passwords are the
 * deliberate exception: re-seeding the inputs would put the secret back into
 * the DOM (and into React state) after a failed attempt. Clearing them is the
 * correct behaviour here, so the fields simply reset and the field errors say
 * what to fix.
 *
 * On success the form is REPLACED rather than reset: the change bumped
 * tokenVersion, so this session is already revoked server-side and the only
 * honest next step is to sign in again.
 */
export function ProfilePasswordForm() {
  const t = useTranslations('adminProfile');
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  function errorLine(key: string) {
    const message = fieldErrors[key];
    if (!message) return null;
    return <p className="text-sm text-destructive">{fieldErrorText(message, t)}</p>;
  }

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await changeOwnPassword(formData);
      if (result.ok) {
        setFieldErrors({});
        setDone(true);
        toast.success(t('changed'));
      } else {
        setFieldErrors(result.fieldErrors ?? {});
        toast.error(t(`errors.${result.error}` as never));
      }
    });
  }

  if (done) {
    return (
      <Panel title={t('changedTitle')} bodyClassName="flex flex-col items-start gap-4">
        <p className="flex items-start gap-2 text-sm">
          <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-(--admin-success)" />
          {t('changedBody')}
        </p>
        {/* A plain form action, like the header's sign-out: the server action
            clears the cookie and redirects, which a fetch could not do. */}
        <form action={endSessionAfterPasswordChange}>
          <Button type="submit" size="lg" className="px-4">
            {t('signInAgain')}
          </Button>
        </form>
      </Panel>
    );
  }

  return (
    <Panel title={t('passwordCard')} bodyClassName="flex flex-col gap-5">
      <SoftNote>{t('passwordLead')}</SoftNote>
      <form action={submit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="currentPassword">{t('currentPassword')}</Label>
          <Input
            id="currentPassword"
            name="currentPassword"
            type="password"
            dir="ltr"
            autoComplete="current-password"
            required
          />
          {errorLine('currentPassword')}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">{t('newPassword')}</Label>
          <Input
            id="password"
            name="password"
            type="password"
            dir="ltr"
            autoComplete="new-password"
            required
          />
          {errorLine('password')}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="confirmPassword">{t('confirmPassword')}</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            dir="ltr"
            autoComplete="new-password"
            required
          />
          {errorLine('confirmPassword')}
        </div>
        <div>
          <Button type="submit" size="lg" className="px-4" disabled={pending}>
            {t('submit')}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
