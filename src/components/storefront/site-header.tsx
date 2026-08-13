import {getLocale} from 'next-intl/server';
import {auth, signOut} from '@/auth';
import {Link} from '@/i18n/navigation';
import {CartBadge} from '@/components/cart/cart-badge';
import {BrandLockup} from '@/components/storefront/brand';
import {AccountMenu} from '@/components/storefront/account-menu';
import {MainNav} from '@/components/storefront/main-nav';
import {MobileMenu} from '@/components/storefront/mobile-menu';
import {SearchButton} from '@/components/storefront/search-button';
import {getMassDiscountPct, getParameters} from '@/server/settings';
import {listVisibleCategoryTree} from '@/server/storefront';
import {routing} from '@/i18n/routing';

// Mockup single-row header (under the service bar): hamburger (below lg) |
// logo + two-line wordmark lockup | centered nav links (lg+) | icon group
// (search popover, account menu, cart drawer). Stays a server component —
// MobileMenu/MainNav/SearchButton/AccountMenu/CartBadge are the client
// leaves, fed the category tree, settings and session facts they cannot
// fetch themselves.
export async function SiteHeader() {
  const [locale, session, parameters, massDiscountPct, categories] = await Promise.all([
    getLocale(),
    auth(),
    getParameters(),
    getMassDiscountPct(),
    listVisibleCategoryTree()
  ]);

  // Sign-out server action, passed to the client AccountMenu so the logout
  // menu item can stay a real <button type="submit"> inside a form.
  async function logout() {
    'use server';
    // Locale-prefixed on purpose: a bare '/' leans on the proxy to redirect,
    // and that middleware hop does not resolve during the client-side
    // navigation this action performs — the address bar moves while the old
    // page stays on screen until a manual refresh.
    await signOut({redirectTo: `/${routing.defaultLocale}`});
  }

  const role = session?.user.role;

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4">
        <MobileMenu categories={categories} />
        {/* Logo bag + two-line wordmark lockup: "Yasmine" (Betterlett script,
            natural case — uppercase/tracking would break a script face) over
            a small tracked "Shop" flanked by short rules. The lockup is the
            SAME Latin brand mark in both locales; its real text keeps the
            link's accessible name "Yasmine Shop" (the flanking rules are
            decorative, aria-hidden). Below sm the lockup goes sr-only
            (logo-only brand) so the crowded mobile row can never overflow. */}
        <BrandLockup hideTextBelowSm />
        {/* Centered nav links, lg+ only (mobile/tablet use the hamburger). */}
        <MainNav categories={categories} />
        {/* Mockup icon group: search, account, cart — locale switcher and
            theme toggle moved inside the account menu. */}
        <div className="ms-auto flex items-center gap-2 lg:ms-0">
          <SearchButton
            locale={locale}
            massDiscountPct={massDiscountPct}
            currencyLabel={parameters.currency}
          />
          <AccountMenu
            isAuthenticated={session !== null}
            isStaff={role === 'ADMIN' || role === 'SUB_ADMIN'}
            logoutAction={logout}
          />
          {/* Client leaf — opens the cart drawer. */}
          <CartBadge />
        </div>
      </div>
    </header>
  );
}
