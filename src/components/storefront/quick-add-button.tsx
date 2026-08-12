'use client';

import {ShoppingCart} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {useCart} from '@/components/cart/cart-provider';

type QuickAddButtonProps = {
  productId: string;
  slug: string;
  nameFr: string;
  nameAr: string;
  // Localized name, only for the accessible label.
  name: string;
  // EFFECTIVE price (mass-discount-aware), computed by the server card.
  // DISPLAY ONLY once in the cart — checkout re-prices from the DB.
  unitPriceMillimes: number;
  imageUrl: string | null;
  outOfStock: boolean;
};

// Card quick add-to-cart: one real cart line (qty 1) through the shared cart
// provider (same MAX_QTY-capped reducer as the product page), then the cart
// drawer opens as feedback. Accessible name is "Ajouter {name} au panier" —
// the interpolated product name keeps it from containing the product page
// CTA's substring 'Ajouter au panier', which e2e targets non-exactly.
export function QuickAddButton({
  productId,
  slug,
  nameFr,
  nameAr,
  name,
  unitPriceMillimes,
  imageUrl,
  outOfStock
}: QuickAddButtonProps) {
  const t = useTranslations('product');
  const {add, openDrawer} = useCart();

  return (
    <button
      type="button"
      disabled={outOfStock}
      aria-label={t('quickAddLabel', {name})}
      onClick={() => {
        add({productId, slug, nameFr, nameAr, unitPriceMillimes, imageUrl}, 1);
        openDrawer();
      }}
      className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-full border border-primary/40 px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:bg-primary focus-visible:text-primary-foreground disabled:pointer-events-none disabled:opacity-45"
    >
      <ShoppingCart className="size-4" aria-hidden="true" />
      {t('quickAdd')}
    </button>
  );
}
