import 'server-only';
import {Prisma} from '@prisma/client';
import {prisma} from '@/lib/db';
import {parametersSchema, type ParametersInput} from '@/lib/schemas/catalog';

export type AppParameters = ParametersInput;

export const DEFAULT_PARAMETERS: AppParameters = {
  deliveryCostMillimes: 7000,
  freeDeliveryThresholdMillimes: 100_000,
  currency: 'TND',
  lastChanceThreshold: 5,
  // Default bulk threshold. Only products that HAVE a gros price are affected.
  wholesaleMinQty: 5,
  copyright: '© 2026 Ma Boutique',
  siteDescription: '',
  keywords: '',
  // Optional owner contact details (Contact page). Empty = not provided —
  // never seed invented values.
  contactPhone: '',
  contactEmail: '',
  socialLinks: {facebook: '', instagram: '', tiktok: ''}
};

export async function getParameters(): Promise<AppParameters> {
  const rows = await prisma.setting.findMany();
  const raw: Record<string, unknown> = {...DEFAULT_PARAMETERS};
  for (const row of rows) {
    if (row.key in DEFAULT_PARAMETERS) raw[row.key] = row.value;
  }
  const parsed = parametersSchema.safeParse(raw);
  return parsed.success ? parsed.data : DEFAULT_PARAMETERS;
}

// Reads the storefront mass-discount percentage directly from its Setting row.
// Deliberately excluded from getParameters (admin screens keep passing null);
// seeded null, Phase 5 adds its admin control.
export async function getMassDiscountPct(): Promise<number | null> {
  const row = await prisma.setting.findUnique({where: {key: 'massDiscountPct'}});
  if (!row) return null;
  const value = row.value;
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100
    ? value
    : null;
}

export async function saveParameters(input: AppParameters): Promise<void> {
  const entries = Object.entries(input) as Array<[string, unknown]>;
  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.setting.upsert({
        where: {key},
        update: {value: value as Prisma.InputJsonValue},
        create: {key, value: value as Prisma.InputJsonValue}
      })
    )
  );
}
