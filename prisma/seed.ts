import 'dotenv/config';
import {access, copyFile, mkdir, readFile} from 'node:fs/promises';
import path from 'node:path';
import {Prisma, PrismaClient} from '@prisma/client';
import {PrismaPg} from '@prisma/adapter-pg';
import {hashPassword} from '../src/lib/password';

/**
 * Replays the shop's real catalogue from prisma/seed-data.json (dumped from a
 * live database by `npx tsx scripts/export-seed-data.ts`) plus the product
 * images that ride alongside it in prisma/seed-assets/.
 *
 * Idempotent: everything is upserted on its natural key (category slug,
 * product reference, promo code, setting key), so running it twice changes
 * nothing and running it against an existing shop refreshes content without
 * touching orders, users or any runtime state.
 *
 * The three local accounts below are DEV credentials created here, not
 * exported: real password hashes never enter the repository. On a real
 * deployment, change these passwords immediately after the first sign-in.
 */

const adapter = new PrismaPg({connectionString: process.env.DATABASE_URL});
const prisma = new PrismaClient({adapter});

const DATA_FILE = path.join(process.cwd(), 'prisma', 'seed-data.json');
const ASSET_DIR = path.join(process.cwd(), 'prisma', 'seed-assets');
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

const USERS = [
  {name: 'Admin', email: 'admin@local.test', password: 'admin123!', role: 'ADMIN'},
  {name: 'Sous Admin', email: 'subadmin@local.test', password: 'subadmin123!', role: 'SUB_ADMIN'},
  {name: 'Client Démo', email: 'client@local.test', password: 'client123!', role: 'CLIENT'}
] as const;

type SeedData = {
  exportedAt: string;
  categories: Array<{
    slug: string;
    nameFr: string;
    nameAr: string;
    parentSlug: string | null;
    archived: boolean;
  }>;
  products: Array<{
    reference: string;
    slug: string;
    nameFr: string;
    nameAr: string;
    descriptionFr: string;
    descriptionAr: string;
    priceMillimes: number;
    discountPct: number;
    quantity: number;
    featured: boolean;
    archived: boolean;
    categorySlug: string;
    subCategorySlug: string | null;
    images: Array<{url: string; sortOrder: number}>;
  }>;
  promoCodes: Array<{
    code: string;
    percentOff: number;
    active: boolean;
    archived: boolean;
    expiresAt: string | null;
  }>;
  settings: Record<string, unknown>;
};

/** '/api/uploads/products/x.webp' -> 'products/x.webp' */
function uploadRelativePath(url: string): string | null {
  const prefix = '/api/uploads/';
  return url.startsWith(prefix) ? url.slice(prefix.length) : null;
}

/**
 * Restores the catalogue's images into uploads/ (git-ignored runtime storage,
 * served by /api/uploads/*). Existing files are left alone so a locally
 * re-uploaded image is never clobbered by a stale copy.
 */
async function restoreImages(data: SeedData): Promise<{copied: number; missing: number}> {
  const wanted = new Set<string>();
  for (const product of data.products) {
    for (const image of product.images) {
      const rel = uploadRelativePath(image.url);
      if (rel) wanted.add(rel);
    }
  }

  let copied = 0;
  let missing = 0;
  for (const rel of wanted) {
    const target = path.join(UPLOAD_DIR, rel);
    try {
      await access(target);
      continue; // already present
    } catch {
      // not there yet — fall through and copy
    }
    try {
      await mkdir(path.dirname(target), {recursive: true});
      await copyFile(path.join(ASSET_DIR, rel), target);
      copied += 1;
    } catch {
      missing += 1;
    }
  }
  return {copied, missing};
}

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.FORCE_SEED !== '1') {
    console.error('Refusing to seed a production database (set FORCE_SEED=1 to override).');
    process.exitCode = 1;
    return;
  }

  const data = JSON.parse(await readFile(DATA_FILE, 'utf8')) as SeedData;

  for (const u of USERS) {
    await prisma.user.upsert({
      where: {email: u.email},
      update: {},
      create: {
        name: u.name,
        email: u.email,
        passwordHash: await hashPassword(u.password),
        role: u.role
      }
    });
  }

  for (const [key, value] of Object.entries(data.settings)) {
    const json = value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
    await prisma.setting.upsert({
      where: {key},
      update: {value: json},
      create: {key, value: json}
    });
  }

  // Roots first: a child's parentId must already exist when it is written.
  const categoryIds = new Map<string, string>();
  const ordered = [
    ...data.categories.filter((c) => c.parentSlug === null),
    ...data.categories.filter((c) => c.parentSlug !== null)
  ];
  for (const c of ordered) {
    const parentId = c.parentSlug ? (categoryIds.get(c.parentSlug) ?? null) : null;
    const fields = {
      nameFr: c.nameFr,
      nameAr: c.nameAr,
      parentId,
      archivedAt: c.archived ? new Date() : null
    };
    const category = await prisma.category.upsert({
      where: {slug: c.slug},
      update: fields,
      create: {slug: c.slug, ...fields}
    });
    categoryIds.set(c.slug, category.id);
  }

  const {copied, missing} = await restoreImages(data);

  for (const p of data.products) {
    const categoryId = categoryIds.get(p.categorySlug);
    if (!categoryId) {
      console.warn(`Skipping ${p.reference}: unknown category "${p.categorySlug}".`);
      continue;
    }
    const fields = {
      slug: p.slug,
      nameFr: p.nameFr,
      nameAr: p.nameAr,
      descriptionFr: p.descriptionFr,
      descriptionAr: p.descriptionAr,
      priceMillimes: p.priceMillimes,
      discountPct: p.discountPct,
      quantity: p.quantity,
      featured: p.featured,
      categoryId,
      subCategoryId: p.subCategorySlug ? (categoryIds.get(p.subCategorySlug) ?? null) : null,
      archivedAt: p.archived ? new Date() : null
    };
    const images = p.images.map((i) => ({url: i.url, sortOrder: i.sortOrder}));
    await prisma.product.upsert({
      where: {reference: p.reference},
      update: {...fields, images: {deleteMany: {}, create: images}},
      create: {reference: p.reference, ...fields, images: {create: images}}
    });
  }

  for (const c of data.promoCodes) {
    const fields = {
      percentOff: c.percentOff,
      active: c.active,
      expiresAt: c.expiresAt ? new Date(c.expiresAt) : null,
      archivedAt: c.archived ? new Date() : null
    };
    await prisma.promoCode.upsert({
      where: {code: c.code},
      update: fields,
      create: {code: c.code, ...fields}
    });
  }

  console.log(
    `Seed complete — ${data.categories.length} categories, ${data.products.length} products, ` +
      `${data.promoCodes.length} promo codes, ${Object.keys(data.settings).length} settings ` +
      `(dump of ${data.exportedAt}).`
  );
  console.log(`Images: ${copied} restored into uploads/, ${missing} missing from seed-assets.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
