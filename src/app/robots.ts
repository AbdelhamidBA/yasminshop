import type {MetadataRoute} from 'next';
import {routing} from '@/i18n/routing';
import {siteOrigin} from '@/lib/site-url';

// Served at /robots.txt.
//
// The disallow list is the SECOND lock on the private surfaces — every one of
// them is already gated server-side (requirePageStaff / requirePageUser / the
// proxy) and marked noindex in its own layout. It is here because a crawler
// only needs one stray link to try, and a 307 to /login still costs crawl
// budget and can surface an ugly redirect chain in Search Console.
//
// /api/ is blocked outright: none of it is a page. That includes
// /api/uploads/*, which serves the product images — those reach Google through
// the product pages and the sitemap's <image> entries instead, where they carry
// their context.
export default function robots(): MetadataRoute.Robots {
  const origin = siteOrigin();
  const private_ = [
    'admin',
    'account',
    'cart',
    'checkout',
    'order-confirmation',
    'invoice',
    'login',
    'register',
    'reset-password'
  ];
  // Both the locale-prefixed and bare forms: the proxy redirects '/cart' to
  // '/fr/cart', and a crawler that found the bare form should not follow it.
  const disallow = [
    '/api/',
    ...private_.map((path) => `/${path}`),
    ...routing.locales.flatMap((locale) => private_.map((path) => `/${locale}/${path}`))
  ];

  return {
    rules: [{userAgent: '*', allow: '/', disallow}],
    sitemap: `${origin}/sitemap.xml`,
    host: origin
  };
}
