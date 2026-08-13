import 'server-only';
import type {Prisma} from '@prisma/client';
import {prisma} from '@/lib/db';
import {pagingArgs} from './paging';

// Admin promo codes data access. Paginated with a $transaction'd count over the
// SAME where clause, so the total can never disagree with the rows.

// Three mutually exclusive tabs. `active` is NOT a new state invented for the
// tabs: it is the very column the per-row Switch (togglePromoCode) writes, so
// "Actifs"/"Inactifs" split the live codes exactly the way the operator toggles
// them. Archiving is the separate, orthogonal axis it already was, and an
// archived code is only ever counted by the archived tab — the three
// where-clauses partition the table with no overlap and no gap.
export const PROMO_CODE_FILTERS = ['active', 'inactive', 'archived'] as const;
export type PromoCodeFilter = (typeof PROMO_CODE_FILTERS)[number];

const PROMO_CODE_WHERE: Record<PromoCodeFilter, Prisma.PromoCodeWhereInput> = {
  active: {archivedAt: null, active: true},
  inactive: {archivedAt: null, active: false},
  archived: {archivedAt: {not: null}}
};

/**
 * Scalar guard turning the URL into a tab. Two independent params, each already
 * used elsewhere in the admin for exactly this: `archived=1` (the archived-only
 * scope every list shares) and `active=0` (the promo-code column the per-row
 * Switch writes). Archived wins, because an archived code is out of play
 * whatever its `active` flag says; anything else lands on the default tab.
 */
export function parsePromoCodeFilter(params: {
  archived?: string;
  active?: string;
}): PromoCodeFilter {
  if (params.archived === '1') return 'archived';
  return params.active === '0' ? 'inactive' : 'active';
}

export type ListPromoCodesParams = {
  filter: PromoCodeFilter;
  page: number;
  pageSize: number;
};

export async function listPromoCodes(params: ListPromoCodesParams) {
  const [promoCodes, active, inactive, archived] = await prisma.$transaction([
    // `code` is unique, so it is a total order on its own — no tiebreak needed
    // for a stable page boundary.
    prisma.promoCode.findMany({
      where: PROMO_CODE_WHERE[params.filter],
      orderBy: {code: 'asc'},
      ...pagingArgs(params)
    }),
    prisma.promoCode.count({where: PROMO_CODE_WHERE.active}),
    prisma.promoCode.count({where: PROMO_CODE_WHERE.inactive}),
    prisma.promoCode.count({where: PROMO_CODE_WHERE.archived})
  ]);

  const counts: Record<PromoCodeFilter, number> = {active, inactive, archived};
  return {promoCodes, counts, total: counts[params.filter]};
}

export type PromoCodeRow = Awaited<ReturnType<typeof listPromoCodes>>['promoCodes'][number];
