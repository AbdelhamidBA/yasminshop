'use client';

import {useActionState, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {Eyebrow} from '@/components/storefront/brand';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Link} from '@/i18n/navigation';
import {fieldErrorText} from '@/lib/field-error';
import {registerClient} from './actions';

// Registration form — login-form idiom (useActionState + server action). The
// password rules (min 8 + confirm match) are ALSO checked client-side in
// onSubmit before the action fires; the server re-validates everything via
// registerSchema regardless.
export function RegisterForm() {
  const t = useTranslations('authPages');
  const isAr = useLocale() === 'ar';
  const [state, formAction, pending] = useActionState(registerClient, undefined);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

  // Client pre-check errors win (they block submission); otherwise show the
  // server's message-KEY fieldErrors.
  const fieldErrors = Object.keys(clientErrors).length
    ? clientErrors
    : state && !state.ok
      ? (state.fieldErrors ?? {})
      : {};

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

  // A non-field failure (e.g. rate limiting) has no fieldErrors — surface it as a
  // generic line above the submit button.
  const formError =
    state && !state.ok && !state.fieldErrors && !Object.keys(clientErrors).length
      ? state.error
      : null;

  // signIn refused after creation (edge case): the account exists — invite a
  // normal sign-in instead of re-submitting a duplicate registration.
  if (state?.ok) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm">{t('register.createdBody')}</p>
        <Button className="h-12 w-full text-sm font-semibold" render={<Link href="/login" />}>
          {t('links.signIn')}
        </Button>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        const formData = new FormData(event.currentTarget);
        const password = String(formData.get('password') ?? '');
        const confirm = String(formData.get('confirmPassword') ?? '');
        const errors: Record<string, string> = {};
        if (password.length < 8) errors.password = 'passwordTooShort';
        else if (password !== confirm) errors.confirmPassword = 'passwordMismatch';
        setClientErrors(errors);
        if (Object.keys(errors).length > 0) event.preventDefault();
      }}
      className="flex flex-col gap-5"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="name" className="text-muted-foreground">
          <Eyebrow tracked={!isAr}>{t('register.name')}</Eyebrow>
        </Label>
        <Input id="name" name="name" autoComplete="name" required className="h-11" />
        {errorLine('name')}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email" className="text-muted-foreground">
          <Eyebrow tracked={!isAr}>{t('register.email')}</Eyebrow>
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          dir="ltr"
          className="h-11"
        />
        {errorLine('email')}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password" className="text-muted-foreground">
          <Eyebrow tracked={!isAr}>{t('register.password')}</Eyebrow>
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
          <Eyebrow tracked={!isAr}>{t('register.confirmPassword')}</Eyebrow>
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
      {formError && <p className="text-sm text-destructive">{errorText(formError)}</p>}
      <Button
        type="submit"
        disabled={pending}
        className="mt-1 h-12 w-full text-sm font-semibold"
      >
        {t('register.submit')}
      </Button>
    </form>
  );
}
