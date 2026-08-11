import {ShoppingCart} from 'lucide-react';
import {getLocale, getTranslations} from 'next-intl/server';
import {auth} from '@/auth';
import {Link} from '@/i18n/navigation';
import {LanguageSwitcher} from '@/components/language-switcher';
import {LogoutButton} from '@/components/logout-button';
import {SearchBox} from '@/components/storefront/search-box';
import {ThemeToggle} from '@/components/theme-toggle';
import {getMassDiscountPct, getParameters} from '@/server/settings';

export async function SiteHeader() {
  const [t, locale, session, parameters, massDiscountPct] = await Promise.all([
    getTranslations(),
    getLocale(),
    auth(),
    getParameters(),
    getMassDiscountPct()
  ]);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="text-lg font-bold">
          {t('common.siteName')}
        </Link>
        <nav className="ms-6 hidden items-center gap-6 text-sm md:flex">
          <Link href="/" className="hover:underline">
            {t('nav.home')}
          </Link>
          <Link href="/products" className="hover:underline">
            {t('nav.products')}
          </Link>
        </nav>
        {/* md+ only per the plan; a mobile-visible search variant is deferred
            (not required this phase). The header stays a server component —
            SearchBox is the client leaf, fed the settings it cannot fetch. */}
        <div className="hidden min-w-0 max-w-sm flex-1 md:block">
          <SearchBox
            locale={locale}
            massDiscountPct={massDiscountPct}
            currencyLabel={parameters.currency}
          />
        </div>
        <div className="ms-auto flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
          <span
            aria-label={t('common.cart')}
            className="flex size-9 items-center justify-center rounded-md border"
          >
            <ShoppingCart className="size-4" />
          </span>
          {session ? (
            <LogoutButton />
          ) : (
            <Link href="/login" className="text-sm font-medium hover:underline">
              {t('common.login')}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
