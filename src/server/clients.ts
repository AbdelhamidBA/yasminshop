import 'server-only';
import type {Prisma} from '@prisma/client';
import {prisma} from '@/lib/db';

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

// Same hard cap as the orders listing: keeps skip = (page-1)*pageSize from
// producing absurd Postgres offsets for URL-sourced page values.
const MAX_PAGE = 10_000;

export type ListClientsParams = {
  q?: string;
  includeArchived: boolean;
  page: number;
  pageSize: number;
};

export async function listClients(params: ListClientsParams) {
  const page =
    Number.isSafeInteger(params.page) && params.page >= 1 && params.page <= MAX_PAGE
      ? params.page
      : 1;
  const pageSize =
    Number.isInteger(params.pageSize) && params.pageSize >= 1 && params.pageSize <= 100
      ? params.pageSize
      : 20;

  const filters: Prisma.UserWhereInput[] = [{role: 'CLIENT'}];
  if (!params.includeArchived) filters.push({archivedAt: null});

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

  const where: Prisma.UserWhereInput = {AND: filters};
  const [clients, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      orderBy: [{createdAt: 'desc'}, {id: 'asc'}],
      select: CLIENT_SELECT,
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.user.count({where})
  ]);
  return {clients, total};
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
