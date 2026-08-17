import type {Metadata} from 'next';
import type {ReactNode} from 'react';
import {notFound} from 'next/navigation';
import {hasLocale, NextIntlClientProvider} from 'next-intl';
import {getMessages, setRequestLocale} from 'next-intl/server';
import {routing} from '@/i18n/routing';
import {ThemeProvider} from '@/components/theme-provider';
import {Toaster} from '@/components/ui/sonner';
import {DEFAULT_DESCRIPTION, OG_IMAGE, SITE_NAME} from '@/lib/seo';
import {siteOrigin} from '@/lib/site-url';
import {getParameters} from '@/server/settings';
import {baloo, betterlett} from '../fonts';
import '../globals.css';

// The site shipped with NO metadata at all, so every page rendered without a
// <title> and browsers fell back to showing the raw URL in the tab, the history
// and any bookmark.
//
// generateMetadata rather than a static export because the description and
// keywords are OWNER-CONFIGURED — the parameters screen has written them since
// Phase 5 and they were feeding nothing at all.
export async function generateMetadata({
  params
}: {
  params: Promise<{locale: string}>;
}): Promise<Metadata> {
  const {locale} = await params;
  const parameters = await getParameters();
  const description = parameters.siteDescription || DEFAULT_DESCRIPTION;
  const keywords = parameters.keywords
    ? parameters.keywords
        .split(',')
        .map((word) => word.trim())
        .filter(Boolean)
    : undefined;

  return {
    // Without a base every relative image path below stays relative — and Open
    // Graph consumers do not resolve relatives, so a shared link would preview
    // with no image at all.
    metadataBase: new URL(siteOrigin()),
    // `template` is what makes the pages that DO set a title useful: a product
    // page returns just the product name (products/[slug]/generateMetadata) and
    // it becomes "Cafetière · Yasmine Shop" rather than either half alone.
    title: {default: SITE_NAME, template: `%s · ${SITE_NAME}`},
    description,
    keywords,
    applicationName: SITE_NAME,
    // Everything under /[locale] inherits this. The surfaces that must NOT be
    // indexed (admin, auth, account, cart, checkout, invoice) override it in
    // their own layouts, and robots.txt disallows them too — belt and braces,
    // since a stray link is enough for a crawler to try.
    robots: {index: true, follow: true},
    alternates: {canonical: `/${locale}`},
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      locale: 'fr_TN',
      url: `/${locale}`,
      title: SITE_NAME,
      description,
      images: [{url: OG_IMAGE, width: 1200, height: 630, alt: SITE_NAME}]
    },
    twitter: {card: 'summary_large_image', title: SITE_NAME, description, images: [OG_IMAGE]}
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}));
}

export default async function LocaleLayout({
  children,
  params
}: {
  children: ReactNode;
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale} dir="ltr" suppressHydrationWarning>
      {/* baloo.variable only DEFINES --font-baloo (usable by portalled
          storefront surfaces); the family is applied inside .theme-yasmine,
          so admin/auth keep the default font stack. */}
      <body className={`${baloo.variable} ${betterlett.variable} antialiased`}>
        <ThemeProvider>
          <NextIntlClientProvider messages={messages}>
            {children}
            <Toaster dir="ltr" position="bottom-center" />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
