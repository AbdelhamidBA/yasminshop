import type {ReactNode} from 'react';
import {getTranslations} from 'next-intl/server';
import {BrandLockup} from '@/components/storefront/brand';

// Shared shell for sign-in, registration and the two password-reset steps.
// These screens used to sit outside the brand entirely — default theme, no
// logo, no way back to the shop — so arriving from the storefront felt like
// leaving the site. They now carry the champagne-gold theme, the lockup (which
// doubles as the route home) and the brand photograph, while staying a focused
// single-column task on the right.
export default async function AuthLayout({children}: {children: ReactNode}) {
  const t = await getTranslations('home');

  return (
    <div className="theme-yasmine grid min-h-svh bg-background text-foreground lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel — lg+ only: below that the photograph would push the form
          under the fold, and signing in is the job on this page. */}
      <div className="relative hidden lg:block">
        <img
          src="/brand/hero.webp"
          alt=""
          className="absolute inset-0 size-full object-cover object-[60%_center]"
        />
        {/* Cream scrim, heavy at the foot, so the ink type stays readable over
            the photograph without hiding the products. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-background via-background/35 to-transparent"
        />
        {/* Anchored to the PHOTOGRAPH, not the writing direction: the flat-lay's
            empty cream area is on its left and the products on its right, so in
            both locales the copy sits bottom-left where there is room for it.
            (Same reasoning as the homepage hero.) The Arabic text still runs
            right-to-left within the block. */}
        <div className="relative flex h-full flex-col items-start justify-end p-12 text-left xl:p-16">
          <p className="max-w-sm text-3xl leading-[1.15] font-extrabold text-balance">
            {t('heroTitle')}
          </p>
          <p className="mt-4 max-w-sm leading-relaxed text-muted-foreground">
            {t('heroSubtitle')}
          </p>
        </div>
      </div>

      <main className="flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          <BrandLockup size="xl" className="justify-center lg:justify-start" />
          <div className="mt-10">{children}</div>
        </div>
      </main>
    </div>
  );
}
