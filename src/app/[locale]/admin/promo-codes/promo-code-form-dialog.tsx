'use client';

import {useEffect, useState, useTransition} from 'react';
import {useTranslations} from 'next-intl';
import {toast} from 'sonner';
import {Button} from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Switch} from '@/components/ui/switch';
import {fieldErrorText} from '@/lib/field-error';
import {createPromoCode, updatePromoCode} from './actions';

export type EditablePromoCode = {
  id: string;
  code: string;
  percentOff: number;
  active: boolean;
  expiresAt: Date | null;
};

function toDateInputValue(date: Date | null): string {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function PromoCodeFormDialog({
  open,
  onOpenChange,
  promoCode
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promoCode: EditablePromoCode | null;
}) {
  const t = useTranslations('admin.promoCodesPage');
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (open) {
      setFieldErrors({});
      setActive(promoCode?.active ?? true);
    }
  }, [open, promoCode]);

  function errorLine(key: string) {
    const message = fieldErrors[key];
    if (!message) return null;
    return <p className="text-sm text-destructive">{fieldErrorText(message, t)}</p>;
  }

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = promoCode
        ? await updatePromoCode(promoCode.id, formData)
        : await createPromoCode(formData);
      if (result.ok) {
        toast.success(t('saved'));
        onOpenChange(false);
      } else {
        setFieldErrors(result.fieldErrors ?? {});
        toast.error(t(`errors.${result.error}` as never));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{promoCode ? t('edit') : t('add')}</DialogTitle>
        </DialogHeader>
        <form action={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="code">{t('code')}</Label>
            <Input
              id="code"
              name="code"
              dir="ltr"
              className="font-mono"
              defaultValue={promoCode?.code ?? ''}
              required
            />
            {errorLine('code')}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="percentOff">{t('percentOff')}</Label>
            <Input
              id="percentOff"
              name="percentOff"
              type="number"
              min={1}
              max={100}
              defaultValue={promoCode?.percentOff ?? ''}
              required
            />
            {errorLine('percentOff')}
          </div>
          <div className="flex items-center gap-3">
            <Switch id="active" checked={active} onCheckedChange={(checked) => setActive(checked)} />
            <Label htmlFor="active">{t('active')}</Label>
            <input type="hidden" name="active" value={active ? 'on' : ''} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="expiresAt">{t('expiresAt')}</Label>
            <Input
              id="expiresAt"
              name="expiresAt"
              type="date"
              dir="ltr"
              defaultValue={toDateInputValue(promoCode?.expiresAt ?? null)}
            />
            {errorLine('expiresAt')}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={pending}>
              {t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
