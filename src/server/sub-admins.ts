import 'server-only';
import type {Prisma} from '@prisma/client';
import {prisma} from '@/lib/db';
import {pagingArgs} from './paging';

// Admin sub-admins data access. Two invariants hold on EVERY query in this
// module (same guarantees as the clients module): only role SUB_ADMIN rows are
// reachable — ADMIN and CLIENT accounts are unreachable here, so this surface
// can never manage the owner ADMIN — and passwordHash is NEVER selected
// (explicit select lists, no bare include/findMany defaults).

const SUB_ADMIN_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  archivedAt: true,
  createdAt: true
} as const;

// One of two mutually exclusive tabs (?archived=1 means archived rows ONLY),
// counted the same way the clients list is: both counts come from the same
// where-builder as the rows — role pin and search included — inside one
// $transaction, so `total` IS the open tab's number.
export type ListSubAdminsParams = {
  q?: string;
  archivedOnly: boolean;
  page: number;
  pageSize: number;
};

export async function listSubAdmins(params: ListSubAdminsParams) {
  // Role SUB_ADMIN is pinned in the very first filter — every query below
  // carries it, so ADMIN / CLIENT rows are structurally unreachable.
  const filters: Prisma.UserWhereInput[] = [{role: 'SUB_ADMIN'}];

  // Scalar guard on the URL-sourced q before any Prisma filter.
  const q = typeof params.q === 'string' ? params.q.trim() : '';
  if (q.length > 0 && q.length <= 200) {
    filters.push({
      OR: [
        {name: {contains: q, mode: 'insensitive'}},
        {email: {contains: q, mode: 'insensitive'}},
        {phone: {contains: q, mode: 'insensitive'}}
      ]
    });
  }

  const whereFor = (archived: boolean): Prisma.UserWhereInput => ({
    AND: [...filters, archived ? {archivedAt: {not: null}} : {archivedAt: null}]
  });

  const [subAdmins, active, archived] = await prisma.$transaction([
    prisma.user.findMany({
      where: whereFor(params.archivedOnly),
      orderBy: [{createdAt: 'desc'}, {id: 'asc'}],
      select: SUB_ADMIN_SELECT,
      ...pagingArgs(params)
    }),
    prisma.user.count({where: whereFor(false)}),
    prisma.user.count({where: whereFor(true)})
  ]);

  const counts = {active, archived};
  return {subAdmins, counts, total: params.archivedOnly ? archived : active};
}

export type SubAdminRow = Awaited<ReturnType<typeof listSubAdmins>>['subAdmins'][number];

// User ids are cuids; same charset allowlist as the clients scalar guard —
// rejects NUL bytes / lone surrogates before any Prisma filter.
const SUB_ADMIN_ID_PATTERN = /^[a-z0-9-]{1,40}$/i;

export async function getSubAdmin(id: string) {
  if (typeof id !== 'string' || !SUB_ADMIN_ID_PATTERN.test(id)) return null;
  // findFirst (not findUnique) so the role pin lives in the WHERE: an ADMIN or
  // CLIENT account id 404s here exactly like an unknown id.
  return prisma.user.findFirst({
    where: {id, role: 'SUB_ADMIN'},
    select: SUB_ADMIN_SELECT
  });
}

export type SubAdminDetail = NonNullable<Awaited<ReturnType<typeof getSubAdmin>>>;
