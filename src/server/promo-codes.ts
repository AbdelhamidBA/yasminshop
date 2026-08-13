import 'server-only';
import type {Prisma} from '@prisma/client';
import {prisma} from '@/lib/db';
import {pagingArgs} from './paging';

// Admin promo codes data access. Paginated with a $transaction'd count over the
// SAME where clause, so the total can never disagree with the rows.

export type ListPromoCodesParams = {
  includeArchived: boolean;
  page: number;
  pageSize: number;
};

export async function listPromoCodes(params: ListPromoCodesParams) {
  const where: Prisma.PromoCodeWhereInput = params.includeArchived ? {} : {archivedAt: null};
  const [promoCodes, total] = await prisma.$transaction([
    // `code` is unique, so it is a total order on its own — no tiebreak needed
    // for a stable page boundary.
    prisma.promoCode.findMany({where, orderBy: {code: 'asc'}, ...pagingArgs(params)}),
    prisma.promoCode.count({where})
  ]);
  return {promoCodes, total};
}

export type PromoCodeRow = Awaited<ReturnType<typeof listPromoCodes>>['promoCodes'][number];
