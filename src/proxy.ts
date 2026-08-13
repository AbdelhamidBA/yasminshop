import NextAuth from 'next-auth';
import createIntlMiddleware from 'next-intl/middleware';
import {authConfig} from '@/auth.config';
import {routing} from '@/i18n/routing';

const intlMiddleware = createIntlMiddleware(routing);
const {auth} = NextAuth(authConfig);

const ADMIN_PATH = /^\/(?:fr\/)?admin(?:\/|$)/;

// Routes staff may still reach outside /admin: the invoice print view (opened
// from an order), sign-in/sign-out, and the password-reset screens. Everything
// else on the storefront is customer territory.
const STAFF_ALLOWED_PATH =
  /^\/(?:fr\/)?(?:invoice(?:\/|$)|login(?:\/|$)|register(?:\/|$)|reset-password(?:\/|$))/;

export default auth((req) => {
  const {nextUrl} = req;

  // Arabic was removed from the product. Without this, an old /ar/... link
  // falls through to next-intl and becomes /fr/ar/... — a 404. Send those
  // links to their French equivalent instead, permanently.
  if (nextUrl.pathname === '/ar' || nextUrl.pathname.startsWith('/ar/')) {
    const rest = nextUrl.pathname.slice('/ar'.length);
    return Response.redirect(new URL(`/fr${rest}${nextUrl.search}`, nextUrl), 308);
  }

  const role = req.auth?.user?.role;
  const isStaff = role === 'ADMIN' || role === 'SUB_ADMIN';

  if (ADMIN_PATH.test(nextUrl.pathname) && !isStaff) {
    return Response.redirect(new URL('/fr/login', nextUrl), 307);
  }

  // Staff belong in the dashboard: a signed-in ADMIN/SUB_ADMIN browsing the
  // shop would be buying from their own store, and the storefront's cart and
  // account surfaces are meaningless for them.
  if (!ADMIN_PATH.test(nextUrl.pathname) && isStaff && !STAFF_ALLOWED_PATH.test(nextUrl.pathname)) {
    return Response.redirect(new URL('/fr/admin', nextUrl), 307);
  }

  return intlMiddleware(req);
});

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
};
