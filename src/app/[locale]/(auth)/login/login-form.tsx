'use client';

import {useActionState, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {Eyebrow} from '@/components/storefront/brand';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {authenticate} from './actions';

export function LoginForm() {
  const t = useTranslations('auth');
  const isAr = useLocale() === 'ar';
  const [error, formAction, pending] = useActionState(authenticate, undefined);
  // React 19 resets an uncontrolled form as soon as its action settles, so a
  // refused sign-in wiped the e-mail too and the whole address had to be typed
  // again. Replay ONLY the e-mail (product-form idiom); the password field is
  // deliberately left to come back empty.
  const [enteredEmail, setEnteredEmail] = useState('');
  const [entryKey, setEntryKey] = useState(0);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        const formData = new FormData(event.currentTarget);
        setEnteredEmail(String(formData.get('email') ?? ''));
        setEntryKey((key) => key + 1);
      }}
      className="flex flex-col gap-5"
    >
      <div className="flex flex-col gap-2">
        {/* Utility-face labels, as on the checkout form. The label TEXT is
            unchanged — only its face — so the field locators still resolve. */}
        <Label htmlFor="email" className="text-muted-foreground">
          <Eyebrow tracked={!isAr}>{t('email')}</Eyebrow>
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          dir="ltr"
          className="h-11"
          key={`email-${entryKey}`}
          defaultValue={enteredEmail}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password" className="text-muted-foreground">
          <Eyebrow tracked={!isAr}>{t('password')}</Eyebrow>
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          dir="ltr"
          className="h-11"
        />
      </div>
      {error && (
        <p className="text-sm text-destructive">
          {t(error === 'rateLimited' ? 'tooManyAttempts' : 'invalidCredentials')}
        </p>
      )}
      <Button type="submit" disabled={pending} className="mt-1 h-12 w-full text-sm font-semibold">
        {t('signIn')}
      </Button>
    </form>
  );
}
