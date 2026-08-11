import 'server-only';
import {prisma} from '@/lib/db';

export async function listPromoCodes(includeArchived: boolean) {
  return prisma.promoCode.findMany({
    where: includeArchived ? {} : {archivedAt: null},
    orderBy: {code: 'asc'}
  });
}

export type PromoCodeRow = Awaited<ReturnType<typeof listPromoCodes>>[number];
