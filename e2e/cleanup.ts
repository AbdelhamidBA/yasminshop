import 'dotenv/config';
import {PrismaClient} from '@prisma/client';
import {PrismaPg} from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({connectionString: process.env.DATABASE_URL})
});

async function main() {
  await prisma.productImage.deleteMany({where: {product: {reference: {startsWith: 'E2E-'}}}});
  await prisma.product.deleteMany({where: {reference: {startsWith: 'E2E-'}}});
  await prisma.category.deleteMany({where: {slug: {startsWith: 'e2e-'}}});
  await prisma.promoCode.deleteMany({where: {code: {startsWith: 'E2E'}}});
  console.log('e2e fixtures cleaned');
}

main().finally(() => prisma.$disconnect());
