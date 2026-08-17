'use server';

import {Prisma} from '@prisma/client';
import {revalidatePath} from 'next/cache';
import {failure, fieldErrorsFromZod, success, type ActionResult} from '@/lib/action-result';
import {AuthzError} from '@/lib/authz';
import {requireAdmin} from '@/server/authz';
import {prisma} from '@/lib/db';
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
    const wholesaleMinQty = Number.parseInt(String(formData.get('wholesaleMinQty') ?? ''), 10);
    const parsed = parametersSchema.safeParse({
      deliveryCostMillimes,
      freeDeliveryThresholdMillimes,
      currency: String(formData.get('currency') ?? ''),
      lastChanceThreshold: Number.isNaN(lastChance) ? -1 : lastChance,
      // -1 rather than NaN so the schema reports 'min' on the field instead of
      // zod's type error, matching how lastChanceThreshold is handled.
      wholesaleMinQty: Number.isNaN(wholesaleMinQty) ? -1 : wholesaleMinQty,
      copyright: String(formData.get('copyright') ?? ''),
      siteDescription: String(formData.get('siteDescription') ?? ''),
      keywords: String(formData.get('keywords') ?? ''),
      contactPhone: String(formData.get('contactPhone') ?? ''),
      contactEmail: String(formData.get('contactEmail') ?? ''),
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

// Global mass-discount override (§6c/§6e): a single percentage applied across
// ALL products by effectivePriceMillimes. Distinct from per-product discountPct
// — this never touches product rows, only the massDiscountPct Setting.
// Apply → integer 0–100; Remove → null (stored as Prisma.JsonNull).
export async function setMassDiscount(pct: number | null): Promise<ActionResult> {
  try {
    await requireAdmin();

    if (pct !== null && (!Number.isInteger(pct) || pct < 0 || pct > 100)) {
      return failure('invalidPct');
    }

    await prisma.setting.upsert({
      where: {key: 'massDiscountPct'},
      update: {value: pct === null ? Prisma.JsonNull : (pct as Prisma.InputJsonValue)},
      create: {
        key: 'massDiscountPct',
        value: pct === null ? Prisma.JsonNull : (pct as Prisma.InputJsonValue)
      }
    });

    // Storefront prices are derived via effectivePriceMillimes, so every page
    // under the (storefront) layout must re-render; the Parameters control
    // reflects the new active value.
    revalidatePath('/[locale]/(storefront)', 'layout');
    revalidatePath('/[locale]/admin/parameters', 'page');
    return success(undefined);
  } catch (error) {
    if (error instanceof AuthzError) return failure('forbidden');
    throw error;
  }
}
