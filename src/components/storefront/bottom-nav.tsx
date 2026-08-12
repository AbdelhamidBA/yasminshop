'use client';

import {Home, Search, ShoppingCart, User} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {useCart} from '@/components/cart/cart-provider';
import {Link} from '@/i18n/navigation';
import {cartCount} from '@/lib/cart';

type BottomNavProps = {
  // Server-decided: /account/orders for signed-in users, /login otherwise.
  isAuthenticated: boolean;
};

// Karina-style fixed bottom navbar, mobile only (md:hidden) and storefront
// only (it lives in the storefront layout, so admin routes never render it).
// Real destinations only — no Favoris (no wishlist exists). The cart entry
// opens the drawer, like the header badge. safe-area padding keeps it clear
// of device insets; the layout adds matching bottom padding so it never
// overlaps the footer.
export function BottomNav({isAuthenticated}: BottomNavProps) {
  const t = useTranslations();
  const {state, hydrated, openDrawer} = useCart();
  const count = cartCount(state);

  const itemCls =
    'flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground';

  // theme-yasmine: rendered outside the storefront layout wrapper (next to
  // the portal-based drawer), so it carries the brand token scope itself.
  return (
    <nav
      aria-label={t('nav.bottomNav')}
      className="theme-yasmine fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <div className="grid grid-cols-4">
        <Link href="/" className={itemCls}>
          <Home className="size-5" aria-hidden="true" />
          {t('nav.home')}
        </Link>
        <Link href="/products" className={itemCls}>
          <Search className="size-5" aria-hidden="true" />
          {t('common.search')}
        </Link>
        <button type="button" onClick={openDrawer} className={itemCls}>
          <span className="relative">
            <ShoppingCart className="size-5" aria-hidden="true" />
            {hydrated && count > 0 && (
              <span
                aria-hidden="true"
                className="absolute -top-1.5 -end-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground"
              >
                {count}
              </span>
            )}
          </span>
          {t('common.cart')}
        </button>
        <Link href={isAuthenticated ? '/account/orders' : '/login'} className={itemCls}>
          <User className="size-5" aria-hidden="true" />
          {t('nav.account')}
        </Link>
      </div>
    </nav>
  );
}
