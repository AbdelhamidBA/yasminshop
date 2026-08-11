'use client';

import {useState, useTransition} from 'react';
import {useTranslations} from 'next-intl';
import {toast} from 'sonner';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {updateProductQuantity} from './actions';

export function QuantityCell({productId, quantity}: {productId: string; quantity: number}) {
  const t = useTranslations('admin.products');
  const [value, setValue] = useState(String(quantity));
  const [pending, startTransition] = useTransition();
  const dirty = value !== String(quantity);

  function save() {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      toast.error(t('errors.invalidQuantity'));
      return;
    }
    startTransition(async () => {
      const result = await updateProductQuantity(productId, parsed);
      if (result.ok) toast.success(t('quantitySaved'));
      else toast.error(t(`errors.${result.error}` as never));
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        min={0}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="w-20"
        dir="ltr"
        aria-label={t('quantity')}
      />
      {dirty && (
        <Button size="sm" variant="outline" onClick={save} disabled={pending}>
          {t('save')}
        </Button>
      )}
    </div>
  );
}
