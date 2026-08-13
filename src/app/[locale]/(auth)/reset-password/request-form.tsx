'use client';

import {useActionState, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {Eyebrow} from '@/components/storefront/brand';
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
  const isAr = locale === 'ar';
  const [state, formAction, pending] = useActionState(requestPasswordReset, undefined);
  // React 19 resets an uncontrolled form as soon as its action settles — the
  // one failure this action can return (rate limit) therefore wiped the
  // address that was just typed. Snapshot it on submit and replay it as the
  // new default; `entryKey` remounts the input (product-form idiom).
  const [entered, setEntered] = useState<Record<string, string>>({});
  const [entryKey, setEntryKey] = useState(0);
  const initial = (field: string) => entered[field] ?? '';

  // Shared localizer: maps a message-KEY through this form's errors.* namespace,
  // falling back to errors.validation — never echoes a raw zod code.
  function errorText(code: string): string {
    return fieldErrorText(code, t);
  }

  if (state?.ok) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm">{t('reset.sentBody')}</p>
        <Button
          variant="outline"
          className="h-12 w-full text-sm font-semibold"
          render={<Link href="/login" />}
        >
          {t('links.backToLogin')}
        </Button>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        // Snapshot before the action runs: with useActionState there is no
        // client-side failure branch to hook, and a rate-limited submit ends
        // in a reset like any other.
        const formData = new FormData(event.currentTarget);
        setEntered({email: String(formData.get('email') ?? '')});
        setEntryKey((key) => key + 1);
      }}
      className="flex flex-col gap-5"
    >
      <p className="text-sm text-muted-foreground">{t('reset.requestIntro')}</p>
      {/* Locale rides along only to build the logged dev URL's prefix. */}
      <input type="hidden" name="locale" value={locale} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="email" className="text-muted-foreground">
          <Eyebrow tracked={!isAr}>{t('reset.email')}</Eyebrow>
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
          defaultValue={initial('email')}
        />
      </div>
      {/* The action otherwise ALWAYS succeeds (no account-existence oracle); the
          only failure it can return is a rate-limit, which is safe to show. */}
      {state && !state.ok && (
        <p className="text-sm text-destructive">{errorText(state.error)}</p>
      )}
      <Button
        type="submit"
        disabled={pending}
        className="mt-1 h-12 w-full text-sm font-semibold"
      >
        {t('reset.sendLink')}
      </Button>
    </form>
  );
}
