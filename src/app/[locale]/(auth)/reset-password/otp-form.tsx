'use client';

import {useState, useTransition} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {Eyebrow} from '@/components/storefront/brand';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Link} from '@/i18n/navigation';
import {fieldErrorText} from '@/lib/field-error';
import {resetPasswordWithOtp} from './actions';

// Step 2 of the reset: the mailed code plus the new password. Same shape and
// styling as the form this replaces (checkout-form idiom: useTransition + a
// direct action call), with the code field added above the password pair.
//
// The e-mail rides in a hidden field rather than being asked for again: the
// code is looked up as hash(userId + code), so the account has to be named, and
// the person on this screen just typed it on the previous one.
//
// The password inputs are NOT replayed after a failed attempt, unlike the other
// forms in this project — re-seeding them would put the new secret back into
// the DOM. The code IS replayed, since a typo in the password should not cost
// the user their code.
export function OtpResetForm({email}: {email: string}) {
  const t = useTranslations('authPages');
  const isAr = useLocale() === 'ar';
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [enteredCode, setEnteredCode] = useState('');
  const [entryKey, setEntryKey] = useState(0);
  const [done, setDone] = useState(false);

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
        <Button className="h-12 w-full text-sm font-semibold" render={<Link href="/login" />}>
          {t('links.signIn')}
        </Button>
      </div>
    );
  }

  function submit(formData: FormData) {
    // Client-side pre-checks mirror the schema so the obvious mistakes never
    // cost a network round trip — or, more importantly, an attempt against the
    // code. The server re-validates everything regardless.
    const code = String(formData.get('code') ?? '').trim();
    const password = String(formData.get('password') ?? '');
    const confirm = String(formData.get('confirmPassword') ?? '');
    const errors: Record<string, string> = {};
    if (!/^\d{6}$/.test(code)) errors.code = 'invalidCodeFormat';
    if (password.length < 8) errors.password = 'passwordTooShort';
    else if (password !== confirm) errors.confirmPassword = 'passwordMismatch';

    setEnteredCode(code);
    setEntryKey((key) => key + 1);

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError(null);
      return;
    }
    setFieldErrors({});
    setFormError(null);
    startTransition(async () => {
      const result = await resetPasswordWithOtp(formData);
      if (result.ok) {
        setDone(true);
      } else {
        setFieldErrors(result.fieldErrors ?? {});
        // 'invalidCode' and 'rateLimited' render as the generic line under the
        // form; a fresh code is one click away.
        setFormError(result.fieldErrors ? null : result.error);
      }
    });
  }

  return (
    <form action={submit} className="flex flex-col gap-5">
      <input type="hidden" name="email" value={email} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="code" className="text-muted-foreground">
          <Eyebrow tracked={!isAr}>{t('reset.code')}</Eyebrow>
        </Label>
        <Input
          id="code"
          name="code"
          // inputMode + autoComplete let a phone offer the code straight from
          // the notification instead of making the user switch apps.
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          dir="ltr"
          className="h-11 text-center text-lg tracking-[0.4em]"
          key={`code-${entryKey}`}
          defaultValue={enteredCode}
        />
        <p className="text-xs text-muted-foreground">{t('reset.codeHint')}</p>
        {errorLine('code')}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password" className="text-muted-foreground">
          <Eyebrow tracked={!isAr}>{t('reset.newPassword')}</Eyebrow>
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          dir="ltr"
          className="h-11"
        />
        <p className="text-xs text-muted-foreground">{t('register.passwordHint')}</p>
        {errorLine('password')}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirmPassword" className="text-muted-foreground">
          <Eyebrow tracked={!isAr}>{t('reset.confirmPassword')}</Eyebrow>
        </Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          dir="ltr"
          className="h-11"
        />
        {errorLine('confirmPassword')}
      </div>
      {formError && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-destructive">{errorText(formError)}</p>
          <Link
            href="/reset-password"
            className="text-sm font-medium text-primary hover:underline"
          >
            {t('reset.requestNew')}
          </Link>
        </div>
      )}
      <Button type="submit" disabled={pending} className="mt-1 h-12 w-full text-sm font-semibold">
        {t('reset.submit')}
      </Button>
    </form>
  );
}
