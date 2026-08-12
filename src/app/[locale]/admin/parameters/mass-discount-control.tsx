'use client';

import {useState, useTransition} from 'react';
import {useTranslations} from 'next-intl';
import {toast} from 'sonner';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {setMassDiscount} from './actions';

// ADMIN-only global mass-discount card. The active value comes from the server
// (currentPct); after apply/remove the action revalidates, so the page re-renders
// with the new currentPct and the status line updates.
export function MassDiscountControl({currentPct}: {currentPct: number | null}) {
  const t = useTranslations('admin.massDiscount');
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(currentPct === null ? '' : String(currentPct));
  const [error, setError] = useState<string | null>(null);

  function run(pct: number | null) {
    setError(null);
    startTransition(async () => {
      const result = await setMassDiscount(pct);
      if (result.ok) {
        toast.success(pct === null ? t('removed') : t('applied'));
      } else {
        if (result.error === 'invalidPct') setError(t('errors.invalidPct'));
        toast.error(t(`errors.${result.error}` as never));
      }
    });
  }

  function apply() {
    const parsed = Number(value.trim());
    if (value.trim() === '' || !Number.isInteger(parsed) || parsed < 0 || parsed > 100) {
      setError(t('errors.invalidPct'));
      return;
    }
    run(parsed);
  }

  function remove() {
    setValue('');
    run(null);
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border bg-card p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium">{t('title')}</h2>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="massDiscountPct">{t('label')}</Label>
        <Input
          id="massDiscountPct"
          name="massDiscountPct"
          type="number"
          min={0}
          max={100}
          dir="ltr"
          value={value}
          disabled={pending}
          onChange={(event) => setValue(event.target.value)}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={apply} disabled={pending}>
          {t('apply')}
        </Button>
        <Button type="button" variant="outline" onClick={remove} disabled={pending}>
          {t('remove')}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        {currentPct === null ? t('inactive') : t('active', {pct: currentPct})}
      </p>
    </section>
  );
}
