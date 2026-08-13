'use client';

import {useState, useTransition} from 'react';
import {useTranslations} from 'next-intl';
import {toast} from 'sonner';
import {
  adminControl, adminPrimaryAction, adminTextarea, Field, FormActions, FormSection
} from '@/components/admin/form';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
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
      {/* `contents` keeps the fieldset's disabled semantics while the section
          cards remain the form's own flex children. */}
      <fieldset disabled={readOnly || pending} className="contents">
        <FormSection title={t('delivery')}>
          <Field
            label={t('deliveryCost')}
            htmlFor="deliveryCost"
            error={errorLine('deliveryCost')}
          >
            <Input
              id="deliveryCost"
              name="deliveryCost"
              dir="ltr"
              className={adminControl}
              defaultValue={millimesToInput(parameters.deliveryCostMillimes)}
            />
          </Field>
          <Field
            label={t('freeDeliveryThreshold')}
            htmlFor="freeDeliveryThreshold"
            error={errorLine('freeDeliveryThreshold')}
          >
            <Input
              id="freeDeliveryThreshold"
              name="freeDeliveryThreshold"
              dir="ltr"
              className={adminControl}
              defaultValue={millimesToInput(parameters.freeDeliveryThresholdMillimes)}
            />
          </Field>
          <Field label={t('currency')} htmlFor="currency" error={errorLine('currency')}>
            <Input
              id="currency"
              name="currency"
              className={adminControl}
              defaultValue={parameters.currency}
            />
          </Field>
          <Field
            label={t('lastChanceThreshold')}
            htmlFor="lastChanceThreshold"
            error={errorLine('lastChanceThreshold')}
          >
            <Input
              id="lastChanceThreshold"
              name="lastChanceThreshold"
              type="number"
              min={0}
              className={adminControl}
              defaultValue={parameters.lastChanceThreshold}
            />
          </Field>
        </FormSection>

        <FormSection title={t('site')}>
          <Field
            label={t('copyright')}
            htmlFor="copyright"
            error={errorLine('copyright')}
            className="sm:col-span-2"
          >
            <Input
              id="copyright"
              name="copyright"
              className={adminControl}
              defaultValue={parameters.copyright}
            />
          </Field>
          <Field
            label={t('siteDescription')}
            htmlFor="siteDescription"
            error={errorLine('siteDescription')}
            className="sm:col-span-2"
          >
            <Textarea
              id="siteDescription"
              name="siteDescription"
              className={adminTextarea}
              defaultValue={parameters.siteDescription}
            />
          </Field>
          <Field
            label={t('keywords')}
            htmlFor="keywords"
            error={errorLine('keywords')}
            className="sm:col-span-2"
          >
            <Input
              id="keywords"
              name="keywords"
              className={adminControl}
              defaultValue={parameters.keywords}
            />
          </Field>
        </FormSection>

        <FormSection title={t('contact')}>
          <Field label={t('contactPhone')} htmlFor="contactPhone" error={errorLine('contactPhone')}>
            <Input
              id="contactPhone"
              name="contactPhone"
              dir="ltr"
              className={adminControl}
              defaultValue={parameters.contactPhone}
            />
          </Field>
          <Field label={t('contactEmail')} htmlFor="contactEmail" error={errorLine('contactEmail')}>
            <Input
              id="contactEmail"
              name="contactEmail"
              dir="ltr"
              className={adminControl}
              defaultValue={parameters.contactEmail}
            />
          </Field>
        </FormSection>

        <FormSection title={t('social')} bodyClassName="sm:grid-cols-3">
          <Field
            label={t('facebook')}
            htmlFor="facebook"
            error={errorLine('socialLinks.facebook')}
          >
            <Input
              id="facebook"
              name="facebook"
              dir="ltr"
              className={adminControl}
              defaultValue={parameters.socialLinks.facebook}
            />
          </Field>
          <Field
            label={t('instagram')}
            htmlFor="instagram"
            error={errorLine('socialLinks.instagram')}
          >
            <Input
              id="instagram"
              name="instagram"
              dir="ltr"
              className={adminControl}
              defaultValue={parameters.socialLinks.instagram}
            />
          </Field>
          <Field label={t('tiktok')} htmlFor="tiktok" error={errorLine('socialLinks.tiktok')}>
            <Input
              id="tiktok"
              name="tiktok"
              dir="ltr"
              className={adminControl}
              defaultValue={parameters.socialLinks.tiktok}
            />
          </Field>
        </FormSection>
      </fieldset>
      {!readOnly && (
        <FormActions>
          <Button type="submit" className={adminPrimaryAction} disabled={pending}>
            {t('save')}
          </Button>
        </FormActions>
      )}
    </form>
  );
}
