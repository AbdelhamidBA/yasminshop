'use server';

import {revalidatePath} from 'next/cache';
import {failure, fieldErrorsFromZod, success, type ActionResult} from '@/lib/action-result';
import {AuthzError} from '@/lib/authz';
import {requireAdmin} from '@/server/authz';
import {parseDinarsToMillimes} from '@/lib/money';
import {parametersSchema} from '@/lib/schemas/catalog';
import {saveParameters} from '@/server/settings';

export async function updateParameters(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();

    const deliveryCostMillimes = parseDinarsToMillimes(String(formData.get('deliveryCost') ?? ''));
    const freeDeliveryThresholdMillimes = parseDinarsToMillimes(
      String(formData.get('freeDeliveryThreshold') ?? '')
    );
    const dinarErrors: Record<string, string> = {};
    if (deliveryCostMillimes === null) dinarErrors.deliveryCost = 'invalidAmount';
    if (freeDeliveryThresholdMillimes === null) dinarErrors.freeDeliveryThreshold = 'invalidAmount';
    if (Object.keys(dinarErrors).length > 0) return failure('validation', dinarErrors);

    const lastChance = Number.parseInt(String(formData.get('lastChanceThreshold') ?? ''), 10);
    const parsed = parametersSchema.safeParse({
      deliveryCostMillimes,
      freeDeliveryThresholdMillimes,
      currency: String(formData.get('currency') ?? ''),
      lastChanceThreshold: Number.isNaN(lastChance) ? -1 : lastChance,
      copyright: String(formData.get('copyright') ?? ''),
      siteDescription: String(formData.get('siteDescription') ?? ''),
      keywords: String(formData.get('keywords') ?? ''),
      socialLinks: {
        facebook: String(formData.get('facebook') ?? ''),
        instagram: String(formData.get('instagram') ?? ''),
        tiktok: String(formData.get('tiktok') ?? '')
      }
    });
    if (!parsed.success) return failure('validation', fieldErrorsFromZod(parsed.error));

    await saveParameters(parsed.data);
    revalidatePath('/[locale]/admin/parameters', 'page');
    return success(undefined);
  } catch (error) {
    if (error instanceof AuthzError) return failure('forbidden');
    throw error;
  }
}
