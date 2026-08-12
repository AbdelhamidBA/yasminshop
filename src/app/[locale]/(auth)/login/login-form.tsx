'use client';

import {useActionState} from 'react';
import {useTranslations} from 'next-intl';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {authenticate} from './actions';

export function LoginForm() {
  const t = useTranslations('auth');
  const [error, formAction, pending] = useActionState(authenticate, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">{t('email')}</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required dir="ltr" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">{t('password')}</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required dir="ltr" />
      </div>
      {error && (
        <p className="text-sm text-destructive">
          {t(error === 'rateLimited' ? 'tooManyAttempts' : 'invalidCredentials')}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {t('signIn')}
      </Button>
    </form>
  );
}
