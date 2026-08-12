import {getLocale, getTranslations} from 'next-intl/server';
import {auth} from '@/auth';
import {Link} from '@/i18n/navigation';
import {CartBadge} from '@/components/cart/cart-badge';
import {LanguageSwitcher} from '@/components/language-switcher';
import {LogoutButton} from '@/components/logout-button';
import {CategoryNav} from '@/components/storefront/category-nav';
import {MobileMenu} from '@/components/storefront/mobile-menu';
import {SearchBox} from '@/components/storefront/search-box';
import {ThemeToggle} from '@/components/theme-toggle';
import {getMassDiscountPct, getParameters} from '@/server/settings';
import {listVisibleCategoryTree} from '@/server/storefront';
import {cn} from '@/lib/utils';

// Karina-style two-row header: logo row (mobile menu | start-aligned logo |
// centered search | actions) over a desktop category-nav row with dropdowns.
// Stays a server component — MobileMenu/CategoryNav/CartBadge are the client
// leaves, fed the category tree and settings they cannot fetch themselves.
export async function SiteHeader() {
  const [t, locale, session, parameters, massDiscountPct, categories] = await Promise.all([
    getTranslations(),
    getLocale(),
    auth(),
    getParameters(),
    getMassDiscountPct(),
    listVisibleCategoryTree()
  ]);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4">
        <MobileMenu categories={categories} />
        {/* YasmineShop logo + wordmark (Phase 8). The image is decorative
            (alt="") — the wordmark text is the link's accessible name. Below
            sm the wordmark goes sr-only (logo-only brand) so the crowded
            mobile row can never overflow the page horizontally. */}
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <img
            src="/brand/yasmine-logo.webp"
            alt=""
            className="h-9 w-auto"
          />
          <span
            className={cn(
              'font-serif font-semibold leading-none max-sm:sr-only sm:text-lg',
              // Uppercase + tracking is FR-only: letter-spacing breaks the
              // joined Arabic script.
              locale !== 'ar' && 'uppercase tracking-[0.16em]'
            )}
          >
            {t('common.siteName')}
          </span>
        </Link>
        {/* md+ only per the plan; mobile reaches the catalog via the bottom
            navbar's search entry. The header stays a server component —
            SearchBox is the client leaf, fed the settings it cannot fetch. */}
        <div className="hidden min-w-0 flex-1 justify-center px-4 md:flex">
          <div className="w-full max-w-sm">
            <SearchBox
              locale={locale}
              massDiscountPct={massDiscountPct}
              currencyLabel={parameters.currency}
            />
          </div>
        </div>
        <div className="ms-auto flex items-center gap-2 md:ms-0">
          <LanguageSwitcher />
          <ThemeToggle />
          {/* Client leaf — opens the cart drawer. */}
          <CartBadge />
          {session ? (
            <>
              {/* Subtle account entry next to logout — same styling as the
                  anonymous login link. */}
              <Link href="/account/orders" className="text-sm font-medium hover:underline">
                {t('myOrders.title')}
              </Link>
              <LogoutButton />
            </>
          ) : (
            <Link href="/login" className="text-sm font-medium hover:underline">
              {t('common.login')}
            </Link>
          )}
        </div>
      </div>
      {/* Desktop category dropdown row (roots + subcategories). */}
      <CategoryNav categories={categories} />
    </header>
  );
}
