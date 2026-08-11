import {z} from 'zod';

const optionalId = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== '' ? v : null));

export const categorySchema = z.object({
  nameFr: z.string().trim().min(1),
  nameAr: z.string().trim().min(1),
  parentId: optionalId
});
export type CategoryInput = z.output<typeof categorySchema>;

export const promoCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[A-Za-z0-9_-]+$/)
    .transform((v) => v.toUpperCase()),
  percentOff: z.number().int().min(1).max(100),
  active: z.boolean(),
  expiresAt: z.date().nullable()
});
export type PromoCodeInput = z.output<typeof promoCodeSchema>;

export const productImageSchema = z.object({
  url: z.string().min(1),
  sortOrder: z.number().int().min(0)
});

export const productSchema = z.object({
  reference: z.string().trim().min(1).max(64),
  nameFr: z.string().trim().min(1),
  nameAr: z.string().trim().min(1),
  descriptionFr: z.string().trim().min(1),
  descriptionAr: z.string().trim().min(1),
  priceMillimes: z.number().int().min(0),
  discountPct: z.number().int().min(0).max(100),
  quantity: z.number().int().min(0),
  featured: z.boolean(),
  categoryId: z.string().min(1),
  subCategoryId: optionalId,
  images: z.array(productImageSchema).min(1)
});
export type ProductInput = z.output<typeof productSchema>;

export const quantitySchema = z.object({
  quantity: z.number().int().min(0)
});

export const parametersSchema = z.object({
  deliveryCostMillimes: z.number().int().min(0),
  freeDeliveryThresholdMillimes: z.number().int().min(0),
  currency: z.string().trim().min(1).max(8),
  lastChanceThreshold: z.number().int().min(0),
  copyright: z.string().trim(),
  siteDescription: z.string().trim(),
  keywords: z.string().trim(),
  socialLinks: z.object({
    facebook: z.string().trim(),
    instagram: z.string().trim(),
    tiktok: z.string().trim()
  })
});
export type ParametersInput = z.output<typeof parametersSchema>;
