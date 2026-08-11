import {z} from 'zod';

// Client-facing checkout schema (spec §6c binding): every constraint carries a
// message KEY — never zod's default English text — which the UI translates via
// t(`checkout.errors.${key}`). Keys: 'required', 'invalidPhone', 'tooShort',
// 'tooLong'. Chained .min(1)/.min(n) makes an empty value surface 'required'
// first (fieldErrorsFromZod keeps the first issue per path) while a non-empty
// but short value surfaces 'tooShort'.
export const checkoutSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, {message: 'required'})
    .min(2, {message: 'tooShort'})
    .max(120, {message: 'tooLong'}),
  phone: z
    .string()
    .trim()
    .min(1, {message: 'required'})
    .regex(/^[0-9+ ]{8,15}$/, {message: 'invalidPhone'}),
  address: z
    .string()
    .trim()
    .min(1, {message: 'required'})
    .min(5, {message: 'tooShort'})
    .max(300, {message: 'tooLong'}),
  city: z
    .string()
    .trim()
    .min(1, {message: 'required'})
    .min(2, {message: 'tooShort'})
    .max(120, {message: 'tooLong'}),
  notes: z.string().trim().max(500, {message: 'tooLong'}).optional(),
  promoCode: z.string().trim().max(64, {message: 'tooLong'}).optional()
});
export type CheckoutInput = z.output<typeof checkoutSchema>;
