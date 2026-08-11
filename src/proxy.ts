import NextAuth from 'next-auth';
import createIntlMiddleware from 'next-intl/middleware';
import {authConfig} from '@/auth.config';
import {routing} from '@/i18n/routing';

const intlMiddleware = createIntlMiddleware(routing);
const {auth} = NextAuth(authConfig);

const ADMIN_PATH = /^\/(?:(?:fr|ar)\/)?admin(?:\/|$)/;

export default auth((req) => {
  const {nextUrl} = req;
  const role = req.auth?.user?.role;

  if (ADMIN_PATH.test(nextUrl.pathname) && role !== 'ADMIN' && role !== 'SUB_ADMIN') {
    const locale = nextUrl.pathname.startsWith('/ar') ? 'ar' : 'fr';
    return Response.redirect(new URL(`/${locale}/login`, nextUrl), 307);
  }

  return intlMiddleware(req);
});

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
};
