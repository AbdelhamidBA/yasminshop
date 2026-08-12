// Dedicated e2e fixture catalog — the suite's ONLY product/promo dependency.
// The owner's real catalog is NEVER read, asserted on, or mutated by any spec.
//
// Lifecycle: e2e/cleanup.ts (suite start) deletes everything these prefixes
// match, then e2e/fixtures.ts recreates the rows below — so fixtures persist
// AFTER a run (inspectable) and are wiped at the start of the next one. The
// established cleanup prefixes cover every row created here:
//   products   → reference startsWith 'E2E-'
//   categories → slug      startsWith 'e2e-'
//   promo code → code      startsWith 'E2E'
//   orders     → customerName startsWith 'E2E ' (placed by the specs)
export const E2E_CATEGORY = {
  slug: 'e2e-fixtures',
  nameFr: 'E2E Fixtures',
  nameAr: 'E2E تجهيزات الاختبار'
} as const;

// All products: featured=false (never pollute the owner's curated sections —
// they still show up in 'Nouveaux produits' while present, unavoidably, since
// that section is createdAt-desc), discountPct=0 (the mass-discount spec needs
// clean base prices: effectivePriceMillimes uses `massDiscountPct ?? discountPct`
// and its baseline asserts NO discounted figure renders), quantity=50 (repeated
// adds and the confirm/cancel stock round-trip never run dry).
export const E2E_PRODUCTS = {
  // Storefront guest journey. Money gate: 129.000 ×3 = 387.000, −10% (E2E10)
  // = 348.300, delivery free above the 100 DT threshold.
  casque: {
    reference: 'E2E-CASQUE',
    slug: 'e2e-casque',
    nameFr: 'E2E Casque Test',
    nameAr: 'E2E سماعة اختبار',
    priceMillimes: 129_000
  },
  // Mass-discount spec, READS ONLY (never ordered, so its price line is
  // stable): 249.000 TND → 224.100 TND at −10% (Math.round(249000 * 0.9)).
  montre: {
    reference: 'E2E-MONTRE',
    slug: 'e2e-montre',
    nameFr: 'E2E Montre Test',
    nameAr: 'E2E ساعة اختبار',
    priceMillimes: 249_000
  },
  // Order-status/stock flows (admin-orders) + the dashboard/bell order. NOT
  // the product the storefront journey orders, so the two specs never dispute
  // the same quantity row.
  cafetiere: {
    reference: 'E2E-CAFETIERE',
    slug: 'e2e-cafetiere',
    nameFr: 'E2E Cafetière Test',
    nameAr: 'E2E قهوة اختبار',
    priceMillimes: 59_000
  },
  // Client-auth journey. Money gate: 9.900 + 7.000 delivery (under the 100 DT
  // free threshold) = 16.900.
  tshirt: {
    reference: 'E2E-TSHIRT',
    slug: 'e2e-tshirt',
    nameFr: 'E2E T-shirt Test',
    nameAr: 'E2E قميص اختبار',
    priceMillimes: 9_900
  }
} as const;

export const E2E_PRODUCT_QUANTITY = 50;

// Suite-owned promo (10% off), replacing the seed BIENVENUE10 dependency —
// the owner can retire seed promos without breaking the suite.
export const E2E_PROMO = {code: 'E2E10', percentOff: 10} as const;
