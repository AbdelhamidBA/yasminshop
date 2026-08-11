import 'dotenv/config';
import {access, mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {Prisma, PrismaClient} from '@prisma/client';
import {PrismaPg} from '@prisma/adapter-pg';
import sharp from 'sharp';
import {hashPassword} from '../src/lib/password';

const adapter = new PrismaPg({connectionString: process.env.DATABASE_URL});
const prisma = new PrismaClient({adapter});

const SETTINGS: Record<string, unknown> = {
  deliveryCostMillimes: 7000,
  freeDeliveryThresholdMillimes: 100_000,
  currency: 'TND',
  lastChanceThreshold: 5,
  massDiscountPct: null,
  socialLinks: {facebook: '', instagram: '', tiktok: ''},
  copyright: '© 2026 Ma Boutique',
  siteDescription: '',
  keywords: ''
};

const USERS = [
  {name: 'Admin', email: 'admin@local.test', password: 'admin123!', role: 'ADMIN'},
  {name: 'Sous Admin', email: 'subadmin@local.test', password: 'subadmin123!', role: 'SUB_ADMIN'},
  {name: 'Client Démo', email: 'client@local.test', password: 'client123!', role: 'CLIENT'}
] as const;

const CATEGORIES = [
  {slug: 'electronique', nameFr: 'Électronique', nameAr: 'إلكترونيات', parentSlug: null},
  {slug: 'maison', nameFr: 'Maison', nameAr: 'منزل', parentSlug: null},
  {slug: 'mode', nameFr: 'Mode', nameAr: 'موضة', parentSlug: null},
  {slug: 'audio', nameFr: 'Audio', nameAr: 'صوتيات', parentSlug: 'electronique'},
  {slug: 'cuisine', nameFr: 'Cuisine', nameAr: 'مطبخ', parentSlug: 'maison'}
] as const;

type SeedColor = {r: number; g: number; b: number};

type SeedProduct = {
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
  categorySlug: string;
  subCategorySlug: string | null;
  color: SeedColor;
};

// Mix required by the plan: 2 featured, 2 low-stock (qty <= 5, > 0), 1 with
// discountPct > 0, 1 out-of-stock (qty 0), prices spread 9.900 -> 899.000 DT.
const PRODUCTS: SeedProduct[] = [
  {
    reference: 'DEMO-001',
    slug: 'casque-sans-fil',
    nameFr: 'Casque sans fil',
    nameAr: 'سماعات لاسلكية',
    descriptionFr: 'Casque Bluetooth avec réduction de bruit.',
    descriptionAr: 'سماعات بلوتوث مع خاصية عزل الضوضاء.',
    priceMillimes: 89_000,
    discountPct: 0,
    quantity: 25,
    featured: true,
    categorySlug: 'electronique',
    subCategorySlug: 'audio',
    color: {r: 59, g: 130, b: 246}
  },
  {
    reference: 'ELEC-002',
    slug: 'enceinte-bluetooth',
    nameFr: 'Enceinte Bluetooth',
    nameAr: 'مكبر صوت بلوتوث',
    descriptionFr: "Enceinte portable étanche avec 12 heures d'autonomie.",
    descriptionAr: 'مكبر صوت محمول مقاوم للماء مع بطارية تدوم 12 ساعة.',
    priceMillimes: 59_900,
    discountPct: 0,
    quantity: 4,
    featured: false,
    categorySlug: 'electronique',
    subCategorySlug: 'audio',
    color: {r: 16, g: 185, b: 129}
  },
  {
    reference: 'ELEC-003',
    slug: 'montre-connectee',
    nameFr: 'Montre connectée',
    nameAr: 'ساعة ذكية',
    descriptionFr: "Montre connectée avec suivi d'activité et GPS intégré.",
    descriptionAr: 'ساعة ذكية مع تتبع النشاط ونظام تحديد المواقع المدمج.',
    priceMillimes: 249_000,
    discountPct: 0,
    quantity: 12,
    featured: true,
    categorySlug: 'electronique',
    subCategorySlug: null,
    color: {r: 139, g: 92, b: 246}
  },
  {
    reference: 'ELEC-004',
    slug: 'televiseur-4k-55',
    nameFr: 'Téléviseur 4K 55 pouces',
    nameAr: 'تلفزيون 4K مقاس 55 بوصة',
    descriptionFr: 'Téléviseur intelligent 4K UHD de 55 pouces avec HDR.',
    descriptionAr: 'تلفزيون ذكي بدقة 4K مقاس 55 بوصة مع تقنية HDR.',
    priceMillimes: 899_000,
    discountPct: 0,
    quantity: 3,
    featured: false,
    categorySlug: 'electronique',
    subCategorySlug: null,
    color: {r: 30, g: 41, b: 59}
  },
  {
    reference: 'MAIS-001',
    slug: 'robot-de-cuisine',
    nameFr: 'Robot de cuisine',
    nameAr: 'روبوت مطبخ',
    descriptionFr: 'Robot multifonction 1000 W avec bol en inox de 4,5 litres.',
    descriptionAr: 'روبوت مطبخ متعدد الوظائف بقوة 1000 واط مع وعاء ستانلس 4.5 لتر.',
    priceMillimes: 329_000,
    discountPct: 15,
    quantity: 8,
    featured: false,
    categorySlug: 'maison',
    subCategorySlug: 'cuisine',
    color: {r: 239, g: 68, b: 68}
  },
  {
    reference: 'MAIS-002',
    slug: 'cafetiere-italienne',
    nameFr: 'Cafetière italienne',
    nameAr: 'ركوة قهوة إيطالية',
    descriptionFr: 'Cafetière moka en aluminium pour 6 tasses.',
    descriptionAr: 'ركوة قهوة موكا من الألومنيوم لست فناجين.',
    priceMillimes: 24_500,
    discountPct: 0,
    quantity: 30,
    featured: false,
    categorySlug: 'maison',
    subCategorySlug: 'cuisine',
    color: {r: 217, g: 119, b: 6}
  },
  {
    reference: 'MODE-001',
    slug: 't-shirt-coton-bio',
    nameFr: 'T-shirt coton bio',
    nameAr: 'قميص قطن عضوي',
    descriptionFr: 'T-shirt unisexe en coton biologique, coupe classique.',
    descriptionAr: 'قميص للجنسين من القطن العضوي بقصة كلاسيكية.',
    priceMillimes: 9_900,
    discountPct: 0,
    quantity: 50,
    featured: false,
    categorySlug: 'mode',
    subCategorySlug: null,
    color: {r: 20, g: 184, b: 166}
  },
  {
    reference: 'MODE-002',
    slug: 'sac-a-main-cuir',
    nameFr: 'Sac à main en cuir',
    nameAr: 'حقيبة يد جلدية',
    descriptionFr: 'Sac à main en cuir véritable avec bandoulière amovible.',
    descriptionAr: 'حقيبة يد من الجلد الطبيعي مع حزام كتف قابل للفصل.',
    priceMillimes: 189_000,
    discountPct: 0,
    quantity: 0,
    featured: false,
    categorySlug: 'mode',
    subCategorySlug: null,
    color: {r: 120, g: 53, b: 15}
  }
];

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'products');

// Same visual pipeline as real uploads (sharp -> webp into uploads/products/,
// served via /api/uploads/products/*): generates a small colored placeholder
// if the file does not already exist.
async function ensureSeedImage(slug: string, color: SeedColor): Promise<string> {
  const name = `seed-${slug}.webp`;
  const file = path.join(UPLOAD_DIR, name);
  try {
    await access(file);
  } catch {
    const buffer = await sharp({
      create: {width: 512, height: 512, channels: 3, background: color}
    })
      .webp({quality: 82})
      .toBuffer();
    await writeFile(file, buffer);
  }
  return `/api/uploads/products/${name}`;
}

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.FORCE_SEED !== '1') {
    console.error('Refusing to seed a production database (set FORCE_SEED=1 to override).');
    process.exitCode = 1;
    return;
  }

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

  for (const [key, value] of Object.entries(SETTINGS)) {
    await prisma.setting.upsert({
      where: {key},
      update: {},
      create: {
        key,
        value: value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue)
      }
    });
  }

  const categoryIds = new Map<string, string>();
  for (const c of CATEGORIES) {
    const parentId = c.parentSlug ? categoryIds.get(c.parentSlug)! : null;
    const category = await prisma.category.upsert({
      where: {slug: c.slug},
      update: {nameFr: c.nameFr, nameAr: c.nameAr, parentId, archivedAt: null},
      create: {nameFr: c.nameFr, nameAr: c.nameAr, slug: c.slug, parentId}
    });
    categoryIds.set(c.slug, category.id);
  }

  await mkdir(UPLOAD_DIR, {recursive: true});
  for (const p of PRODUCTS) {
    const url = await ensureSeedImage(p.slug, p.color);
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
      categoryId: categoryIds.get(p.categorySlug)!,
      subCategoryId: p.subCategorySlug ? categoryIds.get(p.subCategorySlug)! : null,
      archivedAt: null
    };
    await prisma.product.upsert({
      where: {reference: p.reference},
      update: {...fields, images: {deleteMany: {}, create: [{url, sortOrder: 0}]}},
      create: {
        reference: p.reference,
        ...fields,
        images: {create: [{url, sortOrder: 0}]}
      }
    });
  }

  await prisma.promoCode.upsert({
    where: {code: 'BIENVENUE10'},
    update: {percentOff: 10, active: true, expiresAt: null, archivedAt: null},
    create: {code: 'BIENVENUE10', percentOff: 10, active: true, expiresAt: null}
  });

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
