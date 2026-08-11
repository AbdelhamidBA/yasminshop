import 'dotenv/config';
import {Prisma, PrismaClient} from '@prisma/client';
import {PrismaPg} from '@prisma/adapter-pg';
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

async function main() {
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

  const electronics = await prisma.category.upsert({
    where: {slug: 'electronique'},
    update: {},
    create: {nameFr: 'Électronique', nameAr: 'إلكترونيات', slug: 'electronique'}
  });

  const audio = await prisma.category.upsert({
    where: {slug: 'audio'},
    update: {},
    create: {nameFr: 'Audio', nameAr: 'صوتيات', slug: 'audio', parentId: electronics.id}
  });

  await prisma.product.upsert({
    where: {reference: 'DEMO-001'},
    update: {},
    create: {
      reference: 'DEMO-001',
      nameFr: 'Casque sans fil',
      nameAr: 'سماعات لاسلكية',
      descriptionFr: 'Casque Bluetooth avec réduction de bruit.',
      descriptionAr: 'سماعات بلوتوث مع خاصية عزل الضوضاء.',
      priceMillimes: 89_000,
      quantity: 25,
      featured: true,
      categoryId: electronics.id,
      subCategoryId: audio.id,
      images: {create: [{url: '/placeholder-product.svg', sortOrder: 0}]}
    }
  });

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
