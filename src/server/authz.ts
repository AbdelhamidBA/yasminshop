import 'server-only';
import {getLocale} from 'next-intl/server';
import type {Session} from 'next-auth';
import {auth} from '@/auth';
import {redirect} from '@/i18n/navigation';
import {assertRole, type Role} from '@/lib/authz';

export async function requireRole(...allowed: Role[]): Promise<Session> {
  const session = await auth();
  assertRole(session, ...allowed);
  return session;
}

export const requireAdmin = () => requireRole('ADMIN');
export const requireStaff = () => requireRole('ADMIN', 'SUB_ADMIN');

export async function requirePageStaff(): Promise<Session> {
  const session = await auth();
  if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'SUB_ADMIN')) {
    redirect({href: '/login', locale: await getLocale()});
  }
  return session as Session;
}

// Storefront account pages: ANY signed-in role (CLIENT included — staff simply
// see their own data). Same locale-aware redirect idiom as requirePageStaff,
// minus the role check.
export async function requirePageUser(): Promise<Session> {
  const session = await auth();
  if (!session) {
    redirect({href: '/login', locale: await getLocale()});
  }
  return session as Session;
}
