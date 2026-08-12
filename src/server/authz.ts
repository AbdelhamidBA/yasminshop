import 'server-only';
import {getLocale} from 'next-intl/server';
import type {Session} from 'next-auth';
import {auth} from '@/auth';
import {redirect} from '@/i18n/navigation';
import {assertRole, AuthzError, type Role} from '@/lib/authz';
import {prisma} from '@/lib/db';
import {sessionStillValid} from '@/lib/session-validity';

// ── JWT session revocation (Phase 6 Task 3) ──────────────────────────────────
// A live JWT would otherwise survive password reset AND client/sub-admin
// archive/role change until natural expiry. We revoke by comparing the version
// embedded in the token against the user's current DB tokenVersion.
//
// CHOSEN GRANULARITY: the DB re-check runs here, in the server-only require*
// helpers, NOT in the edge jwt/session callback. auth.config.ts is imported by
// middleware and must stay edge-safe (prisma-free), so the callback only
// PERSISTS the version claim; enforcement lives at this choke point — every
// protected staff page/action (requireRole / requirePageStaff) and every
// storefront account surface (requirePageUser) already funnels through here.
// Cost: exactly ONE indexed `user.findUnique` on the primary key per protected
// request. Public/storefront browsing pages never call these helpers, so they
// pay nothing — freshness is bought only where it matters.
async function tokenVersionCurrent(session: Session): Promise<boolean> {
  const dbUser = await prisma.user.findUnique({
    where: {id: session.user.id},
    select: {tokenVersion: true}
  });
  // A vanished user (deleted) is treated as revoked. Pre-existing tokens minted
  // before this feature carry no claim → default 0, matching a never-bumped
  // user, so they are NOT force-logged-out unless a real revocation event fired.
  if (!dbUser) return false;
  return sessionStillValid(session.user.tokenVersion ?? 0, dbUser.tokenVersion);
}

export async function requireRole(...allowed: Role[]): Promise<Session> {
  const session = await auth();
  assertRole(session, ...allowed);
  // Role checked → session is non-null here. Revoked token behaves like a
  // forbidden request (server actions map AuthzError → failure('forbidden')).
  if (!(await tokenVersionCurrent(session))) throw new AuthzError();
  return session;
}

export const requireAdmin = () => requireRole('ADMIN');
export const requireStaff = () => requireRole('ADMIN', 'SUB_ADMIN');

export async function requirePageStaff(): Promise<Session> {
  const session = await auth();
  if (
    !session ||
    (session.user.role !== 'ADMIN' && session.user.role !== 'SUB_ADMIN') ||
    !(await tokenVersionCurrent(session))
  ) {
    redirect({href: '/login', locale: await getLocale()});
  }
  return session as Session;
}

// Storefront account pages: ANY signed-in role (CLIENT included — staff simply
// see their own data). Same locale-aware redirect idiom as requirePageStaff,
// minus the role check. Revocation is gated here too so a reset/archive kills a
// live client session on the next account navigation (My Orders included).
export async function requirePageUser(): Promise<Session> {
  const session = await auth();
  if (!session || !(await tokenVersionCurrent(session))) {
    redirect({href: '/login', locale: await getLocale()});
  }
  return session as Session;
}
