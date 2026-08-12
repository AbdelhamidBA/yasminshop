'use client';

import {useState, useTransition} from 'react';
import {useTranslations} from 'next-intl';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Link} from '@/i18n/navigation';
import {fieldErrorText} from '@/lib/field-error';
import {resetPassword} from '../actions';

// New-password form — checkout-form idiom (useTransition + direct action
// call) so resetPassword keeps its plain (token, formData) signature. Min-8 +
// confirm-match are ALSO checked client-side before the action fires; the
// server re-validates via newPasswordSchema regardless.
export function ResetPasswordForm({token}: {token: string}) {
  const t = useTranslations('authPages');
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Shared localizer: maps a message-KEY through this form's errors.* namespace,
  // falling back to errors.validation — never echoes a raw zod code.
  function errorText(code: string): string {
    return fieldErrorText(code, t);
  }

  function errorLine(key: string) {
    const message = fieldErrors[key];
    if (!message) return null;
    return <p className="text-sm text-destructive">{errorText(message)}</p>;
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm">{t('reset.successBody')}</p>
        <Button render={<Link href="/login" />}>{t('links.signIn')}</Button>
      </div>
    );
  }

  function submit(formData: FormData) {
    const password = String(formData.get('password') ?? '');
    const confirm = String(formData.get('confirmPassword') ?? '');
    const errors: Record<string, string> = {};
    if (password.length < 8) errors.password = 'passwordTooShort';
    else if (password !== confirm) errors.confirmPassword = 'passwordMismatch';
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setFormError(null);
    startTransition(async () => {
      const result = await resetPassword(token, formData);
      if (result.ok) {
        setDone(true);
      } else {
        setFieldErrors(result.fieldErrors ?? {});
        // 'invalidToken' (and any non-field failure) renders as the generic
        // line under the form; a fresh link is one click away.
        setFormError(result.fieldErrors ? null : result.error);
      }
    });
  }

  return (
    <form action={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">{t('reset.newPassword')}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          dir="ltr"
        />
        <p className="text-xs text-muted-foreground">{t('register.passwordHint')}</p>
        {errorLine('password')}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirmPassword">{t('reset.confirmPassword')}</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          dir="ltr"
        />
        {errorLine('confirmPassword')}
      </div>
      {formError && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-destructive">{errorText(formError)}</p>
          {formError === 'invalidToken' && (
            <Link href="/reset-password" className="text-sm font-medium text-primary hover:underline">
              {t('reset.requestNew')}
            </Link>
          )}
        </div>
      )}
      <Button type="submit" disabled={pending}>
        {t('reset.submit')}
      </Button>
    </form>
  );
}
