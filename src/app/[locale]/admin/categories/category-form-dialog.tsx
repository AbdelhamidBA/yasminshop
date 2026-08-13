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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {adminSelectContent} from '@/components/admin/form';
import {fieldErrorText} from '@/lib/field-error';
import {createCategory, updateCategory} from './actions';

export type EditableCategory = {
  id: string;
  nameFr: string;
  nameAr: string;
  parentId: string | null;
};

const NO_PARENT = 'none';

export function CategoryFormDialog({
  open,
  onOpenChange,
  parentOptions,
  category
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentOptions: Array<{id: string; nameFr: string; nameAr: string}>;
  category: EditableCategory | null;
}) {
  const t = useTranslations('admin.categories');
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [parentId, setParentId] = useState<string>(NO_PARENT);
  // React 19 resets an uncontrolled <form action={...}> once the action
  // settles — including when it FAILS validation, which wiped the name that
  // was just typed. Replay the submitted text as the new default; `entryKey`
  // remounts just that input (product-form idiom). The parent Select is React
  // state and already survives.
  const [entered, setEntered] = useState<Record<string, string>>({});
  const [entryKey, setEntryKey] = useState(0);
  const initial = (field: string, fallback: string | number | null | undefined) =>
    entered[field] ?? (fallback === null || fallback === undefined ? '' : String(fallback));

  useEffect(() => {
    if (open) {
      setFieldErrors({});
      // A fresh open must show the row's own values, never the previous
      // attempt's replayed text.
      setEntered({});
      setParentId(category?.parentId ?? NO_PARENT);
    }
  }, [open, category]);

  function errorLine(key: string) {
    const message = fieldErrors[key];
    if (!message) return null;
    return <p className="text-sm text-destructive">{fieldErrorText(message, t)}</p>;
  }

  function submit(formData: FormData) {
    // Snapshot what was typed BEFORE anything else: React resets the form as
    // soon as this action returns, whatever the outcome.
    const typed: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      if (typeof value === 'string') typed[key] = value;
    }
    const restoreTypedValues = () => {
      setEntered(typed);
      setEntryKey((key) => key + 1);
    };

    formData.set('parentId', parentId === NO_PARENT ? '' : parentId);
    startTransition(async () => {
      const result = category
        ? await updateCategory(category.id, formData)
        : await createCategory(formData);
      if (result.ok) {
        toast.success(t('saved'));
        onOpenChange(false);
      } else {
        setFieldErrors(result.fieldErrors ?? {});
        restoreTypedValues();
        toast.error(t(`errors.${result.error}` as never));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{category ? t('edit') : t('add')}</DialogTitle>
        </DialogHeader>
        <form action={submit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="nameFr">{t('nameFr')}</Label>
            <Input
              id="nameFr"
              name="nameFr"
              required
              key={`nameFr-${entryKey}`}
              defaultValue={initial('nameFr', category?.nameFr)}
            />
            {errorLine('nameFr')}
          </div>
          <div className="flex flex-col gap-2">
            <Label>{t('parent')}</Label>
            <Select
              value={parentId}
              onValueChange={(value) => setParentId(value ?? NO_PARENT)}
              items={[
                {value: NO_PARENT, label: t('noParent')},
                ...parentOptions.map((option) => ({value: option.id, label: option.nameFr}))
              ]}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={adminSelectContent}>
                <SelectItem value={NO_PARENT}>{t('noParent')}</SelectItem>
                {parentOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.nameFr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="px-4"
              onClick={() => onOpenChange(false)}
            >
              {t('cancel')}
            </Button>
            <Button type="submit" size="lg" className="px-4" disabled={pending}>
              {t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
