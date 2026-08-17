import 'dotenv/config';
import {copyFile, mkdir, readdir, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {PrismaClient} from '@prisma/client';
import {PrismaPg} from '@prisma/adapter-pg';

/**
 * Dumps the live shop catalogue into the tracked seed data that `prisma/seed.ts`
 * replays, so a fresh database (a new machine, a rebuilt container, the VPS)
 * comes up with the real shop rather than demo placeholders.
 *
 *   npx tsx scripts/export-seed-data.ts
 *
 * WHAT IS EXPORTED: categories, products (with their images), promo codes and
 * settings — the shop's own content, keyed by slug/code/key so replaying it is
 * an idempotent upsert rather than an id-for-id restore.
 *
 * WHAT IS DELIBERATELY NOT EXPORTED — this file is committed to git:
 *   - orders and order items: they carry customer PII (names, phone numbers,
 *     delivery addresses). A committed seed must never contain them.
 *   - users: real password hashes have no business in a repository. seed.ts
 *     creates the three local demo accounts from plaintext dev passwords.
 *   - notifications, push subscriptions, password-reset tokens, search hits:
 *     per-install runtime state, not shop content.
 *
 * This is a CONTENT dump, not a backup. For disaster recovery use pg_dump
 * against the container — that keeps orders, which this intentionally drops.
 */

const adapter = new PrismaPg({connectionString: process.env.DATABASE_URL});
const prisma = new PrismaClient({adapter});

const ROOT = path.join(process.cwd(), 'prisma');
const DATA_FILE = path.join(ROOT, 'seed-data.json');
const ASSET_DIR = path.join(ROOT, 'seed-assets', 'products');
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

/** '/api/uploads/products/x.webp' -> 'products/x.webp' */
function uploadRelativePath(url: string): string | null {
  const prefix = '/api/uploads/';
  return url.startsWith(prefix) ? url.slice(prefix.length) : null;
}

async function main() {
  const categories = await prisma.category.findMany({
    orderBy: {slug: 'asc'},
    select: {
      slug: true,
      nameFr: true,
      nameAr: true,
      archivedAt: true,
      parent: {select: {slug: true}}
    }
  });

  const products = await prisma.product.findMany({
    orderBy: {slug: 'asc'},
    select: {
      reference: true,
      slug: true,
      nameFr: true,
      nameAr: true,
      descriptionFr: true,
      descriptionAr: true,
      priceMillimes: true,
      discountPct: true,
      wholesalePriceMillimes: true,
      wholesaleMinQty: true,
      quantity: true,
      featured: true,
      archivedAt: true,
      category: {select: {slug: true}},
      subCategory: {select: {slug: true}},
      images: {orderBy: {sortOrder: 'asc'}, select: {url: true, sortOrder: true}}
    }
  });

  const promoCodes = await prisma.promoCode.findMany({
    orderBy: {code: 'asc'},
    select: {code: true, percentOff: true, active: true, archivedAt: true, expiresAt: true}
  });

  const settings = await prisma.setting.findMany({
    orderBy: {key: 'asc'},
    select: {key: true, value: true}
  });

  // Copy every referenced upload next to the data file. Only files the
  // catalogue actually points at travel — uploads/ accumulates orphans from
  // edits, and those must not bloat the repository.
  await rm(ASSET_DIR, {recursive: true, force: true});
  await mkdir(ASSET_DIR, {recursive: true});

  const referenced = new Set<string>();
  for (const product of products) {
    for (const image of product.images) {
      const rel = uploadRelativePath(image.url);
      if (rel) referenced.add(rel);
    }
  }

  const missing: string[] = [];
  for (const rel of referenced) {
    const from = path.join(UPLOAD_DIR, rel);
    const to = path.join(ROOT, 'seed-assets', rel);
    await mkdir(path.dirname(to), {recursive: true});
    try {
      await copyFile(from, to);
    } catch {
      missing.push(rel);
    }
  }

  const payload = {
    // Stamped so a future reader knows how stale the dump is. Regenerate with
    // `npx tsx scripts/export-seed-data.ts`.
    exportedAt: new Date().toISOString(),
    categories: categories.map((c) => ({
      slug: c.slug,
      nameFr: c.nameFr,
      nameAr: c.nameAr,
      parentSlug: c.parent?.slug ?? null,
      archived: c.archivedAt !== null
    })),
    products: products.map((p) => ({
      reference: p.reference,
      slug: p.slug,
      nameFr: p.nameFr,
      nameAr: p.nameAr,
      descriptionFr: p.descriptionFr,
      descriptionAr: p.descriptionAr,
      priceMillimes: p.priceMillimes,
      discountPct: p.discountPct,
      wholesalePriceMillimes: p.wholesalePriceMillimes,
      wholesaleMinQty: p.wholesaleMinQty,
      quantity: p.quantity,
      featured: p.featured,
      archived: p.archivedAt !== null,
      categorySlug: p.category.slug,
      subCategorySlug: p.subCategory?.slug ?? null,
      images: p.images.map((i) => ({url: i.url, sortOrder: i.sortOrder}))
    })),
    promoCodes: promoCodes.map((c) => ({
      code: c.code,
      percentOff: c.percentOff,
      active: c.active,
      archived: c.archivedAt !== null,
      expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null
    })),
    settings: Object.fromEntries(settings.map((s) => [s.key, s.value]))
  };

  await writeFile(DATA_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  const assets = await readdir(ASSET_DIR);
  console.log(
    `seed-data.json: ${payload.categories.length} categories, ` +
      `${payload.products.length} products, ${payload.promoCodes.length} promo codes, ` +
      `${Object.keys(payload.settings).length} settings`
  );
  console.log(`seed-assets/products: ${assets.length} images copied`);
  if (missing.length > 0) {
    console.warn(
      `WARNING: ${missing.length} referenced image(s) missing from uploads/ — ` +
        `products will fall back to the placeholder:\n  ${missing.join('\n  ')}`
    );
  }
  console.log('NOT exported (by design): orders, users, notifications — see the file header.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
