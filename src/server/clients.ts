import 'server-only';
import type {Prisma} from '@prisma/client';
import {prisma} from '@/lib/db';
import {pagingArgs} from './paging';

// Admin clients data access. Two invariants hold on EVERY query in this
// module: only role CLIENT rows are reachable (staff accounts are managed on
// the sub-admins surface, never here), and passwordHash is NEVER selected —
// explicit select lists, no bare include/findMany defaults.

const CLIENT_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  address: true,
  city: true,
  archivedAt: true,
  createdAt: true,
  _count: {select: {orders: true}}
} as const;

// The list is filtered by ONE of two mutually exclusive tabs: Actifs (the
// default) or Archivés. `archivedOnly` is what the URL's ?archived=1 means —
// archived rows ONLY, never mixed in with the live ones.
//
// Both tab counts come from the very same where-builder the rows come from —
// search included — inside the same $transaction, so a tab can never disagree
// with the rows it opens, nor with the footer range (`total` IS the open tab's
// count, read out of `counts` rather than queried a second time).
export type ListClientsParams = {
  q?: string;
  archivedOnly: boolean;
  page: number;
  pageSize: number;
};

export async function listClients(params: ListClientsParams) {
  const filters: Prisma.UserWhereInput[] = [{role: 'CLIENT'}];

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

  // Complementary halves of the same (role + search) population: every client
  // is counted by exactly one tab.
  const whereFor = (archived: boolean): Prisma.UserWhereInput => ({
    AND: [...filters, archived ? {archivedAt: {not: null}} : {archivedAt: null}]
  });

  const [clients, active, archived] = await prisma.$transaction([
    prisma.user.findMany({
      where: whereFor(params.archivedOnly),
      orderBy: [{createdAt: 'desc'}, {id: 'asc'}],
      select: CLIENT_SELECT,
      ...pagingArgs(params)
    }),
    prisma.user.count({where: whereFor(false)}),
    prisma.user.count({where: whereFor(true)})
  ]);

  const counts = {active, archived};
  return {clients, counts, total: params.archivedOnly ? archived : active};
}

export type ClientRow = Awaited<ReturnType<typeof listClients>>['clients'][number];

// User ids are cuids; same charset allowlist as the orders scalar guard —
// rejects NUL bytes / lone surrogates before any Prisma filter.
const CLIENT_ID_PATTERN = /^[a-z0-9-]{1,40}$/i;

export async function getClient(id: string) {
  if (typeof id !== 'string' || !CLIENT_ID_PATTERN.test(id)) return null;
  // findFirst (not findUnique) so the role pin lives in the WHERE: a staff
  // account id 404s here exactly like an unknown id.
  return prisma.user.findFirst({
    where: {id, role: 'CLIENT'},
    select: {
      ...CLIENT_SELECT,
      orders: {
        orderBy: [{createdAt: 'desc'}, {id: 'asc'}],
        take: 10,
        select: {
          id: true,
          number: true,
          status: true,
          totalMillimes: true,
          createdAt: true,
          _count: {select: {items: true}}
        }
      }
    }
  });
}

export type ClientDetail = NonNullable<Awaited<ReturnType<typeof getClient>>>;
