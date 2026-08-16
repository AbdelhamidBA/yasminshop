import 'dotenv/config';
import {PrismaClient} from '@prisma/client';
import {PrismaPg} from '@prisma/adapter-pg';
import {splitAddress} from '../src/lib/address';

/**
 * Brings every existing client's profile up to date with their most recent
 * order's delivery details — the one-off counterpart to the sync that
 * createOrderCore now performs on every new order.
 *
 *   npx tsx scripts/backfill-client-addresses.ts          # report only
 *   npx tsx scripts/backfill-client-addresses.ts --write  # apply
 *
 * WHY IT IS NEEDED: registration collects neither phone nor address, so
 * profiles created before this change are blank even for clients who have
 * ordered many times. The orders hold the real data.
 *
 * WHAT IT TOUCHES: phone, address and city on role=CLIENT rows that have at
 * least one order. Never the name (an order may be placed for someone else),
 * never the e-mail, never the password, never an order.
 *
 * Idempotent: re-running after a successful pass reports zero changes, because
 * each profile already equals its latest order.
 */

const adapter = new PrismaPg({connectionString: process.env.DATABASE_URL});
const prisma = new PrismaClient({adapter});

const WRITE = process.argv.includes('--write');

async function main() {
  const clients = await prisma.user.findMany({
    where: {role: 'CLIENT', orders: {some: {}}},
    select: {
      id: true,
      name: true,
      phone: true,
      address: true,
      city: true,
      orders: {
        // Same ordering the admin's client detail page uses, so "latest" means
        // the row an operator sees at the top of that list. The id tiebreak
        // keeps two orders sharing a timestamp from swapping between runs.
        orderBy: [{createdAt: 'desc'}, {id: 'asc'}],
        take: 1,
        select: {number: true, customerPhone: true, customerAddress: true}
      }
    }
  });

  let changed = 0;
  let alreadyCurrent = 0;

  for (const client of clients) {
    const latest = client.orders[0];
    if (!latest) continue;

    const {address, city} = splitAddress(latest.customerAddress);
    const next = {
      phone: latest.customerPhone || null,
      address: address || null,
      city: city || null
    };

    if (
      client.phone === next.phone &&
      client.address === next.address &&
      client.city === next.city
    ) {
      alreadyCurrent += 1;
      continue;
    }

    changed += 1;
    console.log(
      `${WRITE ? 'update' : 'would update'} ${client.name} (order #${latest.number}): ` +
        `phone ${client.phone ?? '—'} -> ${next.phone ?? '—'}, ` +
        `address ${client.address ?? '—'} -> ${next.address ?? '—'}, ` +
        `city ${client.city ?? '—'} -> ${next.city ?? '—'}`
    );

    if (WRITE) {
      // role pinned in the WHERE for the same reason every clients-surface
      // query pins it: this script must never be able to touch a staff row.
      await prisma.user.updateMany({where: {id: client.id, role: 'CLIENT'}, data: next});
    }
  }

  console.log(
    `\n${clients.length} client(s) with orders — ${changed} ${WRITE ? 'updated' : 'would change'}, ` +
      `${alreadyCurrent} already current.`
  );
  if (!WRITE && changed > 0) console.log('Re-run with --write to apply.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
