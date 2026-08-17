import {z} from 'zod';
import {MAX_MILLIMES, MIN_WHOLESALE_QTY} from '../money';

// A wholesale threshold above the cart's own per-line cap could never be
// reached, so the form rejects it rather than silently accepting dead config.
const MAX_QTY_PER_LINE = 99;

const optionalId = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== '' ? v : null));

// Optional free text: trimmed, length-capped, and — crucially — an EMPTY value
// stores NULL rather than "". "No brand" and "a brand that is the empty
// string" must not be two different states in the database.
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, {message: 'tooLong'})
    .optional()
    .transform((v) => (v && v !== '' ? v : null));

// Admin catalog schemas. Like the client-facing checkout/auth schemas (spec §6c
// binding), every constraint carries a message KEY — never zod's default
// English text — so fieldErrorsFromZod surfaces keys the admin forms translate
// via their own `errors.*` namespace through fieldErrorText(). Keys: 'required',
// 'tooShort', 'tooLong', 'invalid', 'min', 'max'. Bounds/logic are unchanged.
export const categorySchema = z.object({
  nameFr: z.string().trim().min(1, {message: 'required'}),
  parentId: optionalId
});
export type CategoryInput = z.output<typeof categorySchema>;

export const promoCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3, {message: 'tooShort'})
    .max(32, {message: 'tooLong'})
    .regex(/^[A-Za-z0-9_-]+$/, {message: 'invalid'})
    .transform((v) => v.toUpperCase()),
  percentOff: z.number().int().min(1, {message: 'min'}).max(100, {message: 'max'}),
  active: z.boolean(),
  expiresAt: z.date().nullable()
});
export type PromoCodeInput = z.output<typeof promoCodeSchema>;

export const productImageSchema = z.object({
  url: z.string().min(1),
  sortOrder: z.number().int().min(0)
});

export const productSchema = z.object({
  reference: z.string().trim().min(1, {message: 'required'}).max(64, {message: 'tooLong'}),
  nameFr: z.string().trim().min(1, {message: 'required'}),
  descriptionFr: z.string().trim().min(1, {message: 'required'}),
  // Free-text manufacturer/brand. Optional: blank means NULL, never "".
  brand: optionalText(80),
  priceMillimes: z.number().int().min(0, {message: 'min'}).max(MAX_MILLIMES, {message: 'max'}),
  discountPct: z.number().int().min(0, {message: 'min'}).max(100, {message: 'max'}),
  // Wholesale. NULLABLE, not 0-defaulted: a blank field means "this product has
  // no gros price", which is a different thing from "its gros price is zero".
  wholesalePriceMillimes: z
    .number()
    .int()
    .min(0, {message: 'min'})
    .max(MAX_MILLIMES, {message: 'max'})
    .nullable(),
  // MIN_WHOLESALE_QTY is the floor: a threshold of 0 or 1 would make the gros
  // price the only price the product has, which is a mistake rather than a
  // deal. Blank falls back to the shop-wide default.
  wholesaleMinQty: z
    .number()
    .int()
    .min(MIN_WHOLESALE_QTY, {message: 'min'})
    .max(MAX_QTY_PER_LINE, {message: 'max'})
    .nullable(),
  quantity: z.number().int().min(0, {message: 'min'}),
  featured: z.boolean(),
  categoryId: z.string().min(1, {message: 'required'}),
  subCategoryId: optionalId,
  images: z.array(productImageSchema).min(1, {message: 'required'})
});
export type ProductInput = z.output<typeof productSchema>;

export const quantitySchema = z.object({
  quantity: z.number().int().min(0, {message: 'min'})
});

export const parametersSchema = z.object({
  deliveryCostMillimes: z
    .number()
    .int()
    .min(0, {message: 'min'})
    .max(MAX_MILLIMES, {message: 'max'}),
  freeDeliveryThresholdMillimes: z
    .number()
    .int()
    .min(0, {message: 'min'})
    .max(MAX_MILLIMES, {message: 'max'}),
  currency: z.string().trim().min(1, {message: 'required'}).max(8, {message: 'tooLong'}),
  lastChanceThreshold: z.number().int().min(0, {message: 'min'}),
  // Shop-wide default quantity at which a line switches to its wholesale
  // price. A product may override it; a product with no gros price ignores it.
  wholesaleMinQty: z
    .number()
    .int()
    .min(MIN_WHOLESALE_QTY, {message: 'min'})
    .max(MAX_QTY_PER_LINE, {message: 'max'}),
  copyright: z.string().trim(),
  siteDescription: z.string().trim(),
  keywords: z.string().trim(),
  // Optional owner contact details — empty string means "not provided" (the
  // storefront Contact page hides the corresponding field).
  contactPhone: z.string().trim(),
  contactEmail: z.string().trim(),
  socialLinks: z.object({
    facebook: z.string().trim(),
    instagram: z.string().trim(),
    tiktok: z.string().trim()
  })
});
export type ParametersInput = z.output<typeof parametersSchema>;
