'use client';

import {useState, useTransition} from 'react';
import {useTranslations} from 'next-intl';
import {toast} from 'sonner';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Textarea} from '@/components/ui/textarea';
import {fieldErrorText} from '@/lib/field-error';
import {millimesToInput} from '@/lib/money';
import type {AppParameters} from '@/server/settings';
import {updateParameters} from './actions';

export function ParametersForm({
  parameters,
  readOnly
}: {
  parameters: AppParameters;
  readOnly: boolean;
}) {
  const t = useTranslations('admin.parameters');
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await updateParameters(formData);
      if (result.ok) {
        setFieldErrors({});
        toast.success(t('saved'));
      } else {
        setFieldErrors(result.fieldErrors ?? {});
        toast.error(t(`errors.${result.error}` as never));
      }
    });
  }

  function errorLine(key: string) {
    const message = fieldErrors[key];
    if (!message) return null;
    return <p className="text-sm text-destructive">{fieldErrorText(message, t)}</p>;
  }

  return (
    <form action={submit} className="flex flex-col gap-6">
      <fieldset disabled={readOnly || pending} className="flex flex-col gap-6">
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-medium">{t('delivery')}</h2>
          <div className="flex flex-col gap-2">
            <Label htmlFor="deliveryCost">{t('deliveryCost')}</Label>
            <Input
              id="deliveryCost"
              name="deliveryCost"
              dir="ltr"
              defaultValue={millimesToInput(parameters.deliveryCostMillimes)}
            />
            {errorLine('deliveryCost')}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="freeDeliveryThreshold">{t('freeDeliveryThreshold')}</Label>
            <Input
              id="freeDeliveryThreshold"
              name="freeDeliveryThreshold"
              dir="ltr"
              defaultValue={millimesToInput(parameters.freeDeliveryThresholdMillimes)}
            />
            {errorLine('freeDeliveryThreshold')}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="currency">{t('currency')}</Label>
            <Input id="currency" name="currency" defaultValue={parameters.currency} />
            {errorLine('currency')}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="lastChanceThreshold">{t('lastChanceThreshold')}</Label>
            <Input
              id="lastChanceThreshold"
              name="lastChanceThreshold"
              type="number"
              min={0}
              defaultValue={parameters.lastChanceThreshold}
            />
            {errorLine('lastChanceThreshold')}
          </div>
        </section>
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-medium">{t('site')}</h2>
          <div className="flex flex-col gap-2">
            <Label htmlFor="copyright">{t('copyright')}</Label>
            <Input id="copyright" name="copyright" defaultValue={parameters.copyright} />
            {errorLine('copyright')}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="siteDescription">{t('siteDescription')}</Label>
            <Textarea
              id="siteDescription"
              name="siteDescription"
              defaultValue={parameters.siteDescription}
            />
            {errorLine('siteDescription')}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="keywords">{t('keywords')}</Label>
            <Input id="keywords" name="keywords" defaultValue={parameters.keywords} />
            {errorLine('keywords')}
          </div>
        </section>
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-medium">{t('social')}</h2>
          <div className="flex flex-col gap-2">
            <Label htmlFor="facebook">{t('facebook')}</Label>
            <Input
              id="facebook"
              name="facebook"
              dir="ltr"
              defaultValue={parameters.socialLinks.facebook}
            />
            {errorLine('socialLinks.facebook')}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="instagram">{t('instagram')}</Label>
            <Input
              id="instagram"
              name="instagram"
              dir="ltr"
              defaultValue={parameters.socialLinks.instagram}
            />
            {errorLine('socialLinks.instagram')}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="tiktok">{t('tiktok')}</Label>
            <Input
              id="tiktok"
              name="tiktok"
              dir="ltr"
              defaultValue={parameters.socialLinks.tiktok}
            />
            {errorLine('socialLinks.tiktok')}
          </div>
        </section>
      </fieldset>
      {!readOnly && (
        <div>
          <Button type="submit" disabled={pending}>
            {t('save')}
          </Button>
        </div>
      )}
    </form>
  );
}
