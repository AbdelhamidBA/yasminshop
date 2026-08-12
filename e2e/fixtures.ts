import 'dotenv/config';
import {PrismaClient} from '@prisma/client';
import {PrismaPg} from '@prisma/adapter-pg';
import {E2E_CATEGORY, E2E_PRODUCT_QUANTITY, E2E_PRODUCTS, E2E_PROMO} from './fixture-data';

// Creates the dedicated e2e fixture catalog (see e2e/fixture-data.ts). Runs
// from global-setup AFTER e2e/cleanup.ts, so a plain create would suffice —
// upserts merely keep a manual `npx tsx e2e/fixtures.ts` re-run idempotent.
// Direct Prisma client (cleanup.ts idiom); NEVER touches non-'e2e-' rows.
const prisma = new PrismaClient({
  adapter: new PrismaPg({connectionString: process.env.DATABASE_URL})
});

async function main() {
  const category = await prisma.category.upsert({
    where: {slug: E2E_CATEGORY.slug},
    update: {nameFr: E2E_CATEGORY.nameFr, nameAr: E2E_CATEGORY.nameAr, parentId: null, archivedAt: null},
    create: {...E2E_CATEGORY}
  });

  for (const product of Object.values(E2E_PRODUCTS)) {
    // Full reset in the update branch so a leftover mutated row (aborted run)
    // still converges to the canonical fixture state.
    const data = {
      ...product,
      descriptionFr: 'Produit fixture e2e — recréé à chaque exécution de la suite.',
      descriptionAr: 'منتج اختبار e2e — يعاد إنشاؤه في كل تشغيل.',
      discountPct: 0,
      quantity: E2E_PRODUCT_QUANTITY,
      featured: false,
      searchHits: 0,
      categoryId: category.id,
      subCategoryId: null,
      archivedAt: null
    };
    await prisma.product.upsert({where: {slug: product.slug}, update: data, create: data});
  }

  await prisma.promoCode.upsert({
    where: {code: E2E_PROMO.code},
    update: {percentOff: E2E_PROMO.percentOff, active: true, expiresAt: null, archivedAt: null},
    create: {code: E2E_PROMO.code, percentOff: E2E_PROMO.percentOff, active: true, expiresAt: null}
  });

  console.log('e2e fixtures created');
}

main().finally(() => prisma.$disconnect());
