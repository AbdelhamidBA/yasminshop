import 'dotenv/config';
import {Prisma, PrismaClient} from '@prisma/client';
import {PrismaPg} from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({connectionString: process.env.DATABASE_URL})
});

const E2E_CUSTOMER = {customerName: {startsWith: 'E2E '}};
const E2E_CLIENT_USER = {email: {startsWith: 'e2e-client'}};
const E2E_SUB_ADMIN_USER = {email: {startsWith: 'e2e-subadmin'}};

// FK-safe order teardown: NEW_ORDER notifications first (matched to the order
// ids via the JSON payload, one path-filtered deleteMany per id — always a
// handful at most), then items, then the orders themselves.
async function deleteOrders(where: Prisma.OrderWhereInput) {
  const orders = await prisma.order.findMany({where, select: {id: true}});
  for (const {id} of orders) {
    await prisma.notification.deleteMany({
      where: {type: 'NEW_ORDER', payload: {path: ['orderId'], equals: id}}
    });
  }
  await prisma.orderItem.deleteMany({where: {order: where}});
  await prisma.order.deleteMany({where});
}

async function main() {
  // Checkout fixtures: ONLY orders whose customerName starts with 'E2E ' —
  // real/manual orders in the dev DB (order #1 included) are never touched.
  // Runs before the product cleanup so an order line could never block a
  // product delete.
  await deleteOrders(E2E_CUSTOMER);

  // Registered e2e clients (client-auth journey): their orders go first too
  // (a checkout could carry a session-prefilled, non-'E2E ' customerName),
  // then their password-reset tokens, then the users. The 'e2e-client' email
  // prefix can never match the seeded users (admin@/subadmin@/client@local.test).
  await deleteOrders({client: E2E_CLIENT_USER});
  await prisma.passwordResetToken.deleteMany({where: {user: E2E_CLIENT_USER}});
  await prisma.user.deleteMany({where: E2E_CLIENT_USER});

  // Sub-admins the dashboard/notifications journey creates (email prefix
  // 'e2e-subadmin', never a seed's subadmin@local.test). Same FK-safe order:
  // any orders they carry first (guarded by deleteOrders), then reset-tokens and
  // push subscriptions cascade on the user delete. The prefix can never match
  // the seeded subadmin@local.test.
  await deleteOrders({client: E2E_SUB_ADMIN_USER});
  await prisma.passwordResetToken.deleteMany({where: {user: E2E_SUB_ADMIN_USER}});
  await prisma.user.deleteMany({where: E2E_SUB_ADMIN_USER});

  await prisma.productImage.deleteMany({where: {product: {reference: {startsWith: 'E2E-'}}}});
  await prisma.product.deleteMany({where: {reference: {startsWith: 'E2E-'}}});
  await prisma.category.deleteMany({where: {slug: {startsWith: 'e2e-'}}});
  await prisma.promoCode.deleteMany({where: {code: {startsWith: 'E2E'}}});

  // CRITICAL: reset the global mass discount to null. The dashboard spec applies
  // a discount mid-run; a left-on massDiscountPct would re-price every product
  // and corrupt the other specs' exact price assertions. Upsert (not update) so
  // a missing row is recreated as JsonNull — matching the seed's null default.
  await prisma.setting.upsert({
    where: {key: 'massDiscountPct'},
    update: {value: Prisma.JsonNull},
    create: {key: 'massDiscountPct', value: Prisma.JsonNull}
  });
  console.log('e2e fixtures cleaned');
}

main().finally(() => prisma.$disconnect());
