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
  copyright: '© 2026 Ma Boutique',
  siteDescription: '',
  keywords: '',
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
