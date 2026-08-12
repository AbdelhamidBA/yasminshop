'use client';

import {useActionState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Link} from '@/i18n/navigation';
import {fieldErrorText} from '@/lib/field-error';
import {requestPasswordReset} from './actions';

// Reset-request form (login-form idiom). The action ALWAYS succeeds — the
// sent-state copy is deliberately worded "if an account exists…" so the UI
// carries no account-existence oracle either.
export function RequestResetForm() {
  const t = useTranslations('authPages');
  const locale = useLocale();
  const [state, formAction, pending] = useActionState(requestPasswordReset, undefined);

  // Shared localizer: maps a message-KEY through this form's errors.* namespace,
  // falling back to errors.validation — never echoes a raw zod code.
  function errorText(code: string): string {
    return fieldErrorText(code, t);
  }

  if (state?.ok) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm">{t('reset.sentBody')}</p>
        <Button variant="outline" render={<Link href="/login" />}>
          {t('links.backToLogin')}
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t('reset.requestIntro')}</p>
      {/* Locale rides along only to build the logged dev URL's prefix. */}
      <input type="hidden" name="locale" value={locale} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">{t('reset.email')}</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required dir="ltr" />
      </div>
      {/* The action otherwise ALWAYS succeeds (no account-existence oracle); the
          only failure it can return is a rate-limit, which is safe to show. */}
      {state && !state.ok && (
        <p className="text-sm text-destructive">{errorText(state.error)}</p>
      )}
      <Button type="submit" disabled={pending}>
        {t('reset.sendLink')}
      </Button>
    </form>
  );
}
