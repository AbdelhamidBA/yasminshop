'use client';

import {useState, useTransition} from 'react';
import {useTranslations} from 'next-intl';
import {toast} from 'sonner';
import {adminControl, adminPrimaryAction, adminQuietAction, Field, Panel} from '@/components/admin/form';
import {StatusLabel} from '@/components/admin/ui';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
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
        // effectivePriceMillimes resolves `massDiscountPct ?? discountPct`, so
        // the descriptions state exactly what the toggle does to per-product
        // discounts. Removing it is a state reset, not an achievement — info.
        if (pct === null) {
          toast.info(t('removed'), {description: t('removedDescription')});
        } else {
          toast.success(t('applied'), {description: t('appliedDescription')});
        }
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
    <Panel
      title={t('title')}
      description={t('description')}
      bodyClassName="flex flex-col gap-5"
      actions={
        <StatusLabel tone={currentPct === null ? 'neutral' : 'success'}>
          {currentPct === null ? t('inactive') : t('active', {pct: currentPct})}
        </StatusLabel>
      }
    >
      <div className="flex flex-wrap items-end gap-3">
        <Field label={t('label')} htmlFor="massDiscountPct" className="w-44">
          <Input
            id="massDiscountPct"
            name="massDiscountPct"
            type="number"
            min={0}
            max={100}
            dir="ltr"
            className={adminControl}
            value={value}
            disabled={pending}
            onChange={(event) => setValue(event.target.value)}
          />
        </Field>
        <div className="flex flex-wrap items-center gap-3 pb-0.5">
          <Button type="button" className={adminPrimaryAction} onClick={apply} disabled={pending}>
            {t('apply')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className={adminQuietAction}
            onClick={remove}
            disabled={pending}
          >
            {t('remove')}
          </Button>
        </div>
      </div>
      {error !== null && <p className="text-sm text-destructive">{error}</p>}
    </Panel>
  );
}
