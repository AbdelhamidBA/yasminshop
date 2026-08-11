import 'server-only';
import {prisma} from '@/lib/db';

// Validates a client-supplied promo code against spec §6c:
// usable iff archivedAt === null && active && (expiresAt === null || expiresAt > now).
export async function validatePromoCode(
  code: string
): Promise<{code: string; percentOff: number} | null> {
  // Scalar guard on the raw client value before any Prisma filter (Phase 2 fix-wave idiom).
  if (typeof code !== 'string') return null;
  const normalized = code.trim().toUpperCase();
  // Codes are 3–32 chars by schema; anything outside can never match.
  if (normalized.length < 3 || normalized.length > 32) return null;

  const promo = await prisma.promoCode.findUnique({where: {code: normalized}});
  if (!promo) return null;
  if (promo.archivedAt !== null) return null;
  if (!promo.active) return null;
  if (promo.expiresAt !== null && promo.expiresAt <= new Date()) return null;
  return {code: promo.code, percentOff: promo.percentOff};
}
