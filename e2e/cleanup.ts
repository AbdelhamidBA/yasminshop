import 'dotenv/config';
import {PrismaClient} from '@prisma/client';
import {PrismaPg} from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({connectionString: process.env.DATABASE_URL})
});

const E2E_CUSTOMER = {customerName: {startsWith: 'E2E '}};

async function main() {
  // Checkout fixtures: ONLY orders whose customerName starts with 'E2E ' —
  // real/manual orders in the dev DB are never touched. FK-safe sequence:
  // NEW_ORDER notifications (matched to the order ids via the JSON payload,
  // one path-filtered deleteMany per id — always a handful at most) → items →
  // orders. Runs before the product cleanup so an order line could never
  // block a product delete.
  const e2eOrders = await prisma.order.findMany({where: E2E_CUSTOMER, select: {id: true}});
  for (const {id} of e2eOrders) {
    await prisma.notification.deleteMany({
      where: {type: 'NEW_ORDER', payload: {path: ['orderId'], equals: id}}
    });
  }
  await prisma.orderItem.deleteMany({where: {order: E2E_CUSTOMER}});
  await prisma.order.deleteMany({where: E2E_CUSTOMER});

  await prisma.productImage.deleteMany({where: {product: {reference: {startsWith: 'E2E-'}}}});
  await prisma.product.deleteMany({where: {reference: {startsWith: 'E2E-'}}});
  await prisma.category.deleteMany({where: {slug: {startsWith: 'e2e-'}}});
  await prisma.promoCode.deleteMany({where: {code: {startsWith: 'E2E'}}});
  console.log('e2e fixtures cleaned');
}

main().finally(() => prisma.$disconnect());
