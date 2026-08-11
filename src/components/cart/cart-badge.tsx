'use client';

import {ShoppingCart} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {useCart} from '@/components/cart/cart-provider';
import {Link} from '@/i18n/navigation';
import {cartCount} from '@/lib/cart';

// Header cart icon linking to /cart. The count bubble stays hidden until the
// provider has hydrated from localStorage so server and first client render
// agree (no hydration mismatch).
export function CartBadge() {
  const t = useTranslations('common');
  const {state, hydrated} = useCart();
  const count = cartCount(state);

  return (
    <Link
      href="/cart"
      aria-label={t('cart')}
      className="relative flex size-9 items-center justify-center rounded-md border hover:bg-accent"
    >
      <ShoppingCart className="size-4" />
      {hydrated && count > 0 && (
        <span
          aria-hidden="true"
          className="absolute -top-1.5 -end-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground"
        >
          {count}
        </span>
      )}
    </Link>
  );
}
