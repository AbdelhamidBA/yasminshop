'use client';

import {useId, useState} from 'react';
import {useTranslations} from 'next-intl';
import {useCart} from '@/components/cart/cart-provider';
import {Button} from '@/components/ui/button';
import {MAX_QTY} from '@/lib/cart';

type AddToCartProps = {
  productId: string;
  slug: string;
  nameFr: string;
  nameAr: string;
  // EFFECTIVE price (mass-discount-aware), computed server-side by the page.
  // DISPLAY ONLY once in the cart — checkout re-prices from the DB.
  unitPriceMillimes: number;
  imageUrl: string | null;
  // Available stock; the stepper is capped at min(MAX_QTY, quantity).
  quantity: number;
};

// Quantity stepper (1..min(99, stock)) + prominent add-to-cart button.
// When the product is out of stock the button is disabled and carries the
// out-of-stock label instead.
export function AddToCart({
  productId,
  slug,
  nameFr,
  nameAr,
  unitPriceMillimes,
  imageUrl,
  quantity
}: AddToCartProps) {
  const t = useTranslations('product');
  const {add, openDrawer} = useCart();
  const labelId = useId();
  const [qty, setQty] = useState(1);

  const outOfStock = quantity === 0;
  const maxQty = Math.min(MAX_QTY, quantity);

  function onAdd() {
    add({productId, slug, nameFr, nameAr, unitPriceMillimes, imageUrl}, qty);
    // The cart drawer replaces the success toast as add feedback (Phase 7):
    // it shows the added line, quantity and the cart/checkout CTAs directly.
    openDrawer();
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <span id={labelId} className="text-sm font-medium">
        {t('quantity')}
      </span>
      {/* Karina-soft stepper: pill outline, roomier hit targets. Locator
          surfaces preserved exactly — +/− button text, their aria-labels and
          the aria-live qty span (Phase 6 a11y). */}
      <div
        role="group"
        aria-labelledby={labelId}
        className="flex h-12 items-center rounded-lg border bg-card px-1"
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('decreaseQuantity')}
          disabled={outOfStock || qty <= 1}
          onClick={() => setQty((prev) => Math.max(1, prev - 1))}
          className="rounded-lg"
        >
          −
        </Button>
        <span aria-live="polite" className="w-10 text-center text-base font-semibold tabular-nums">
          {outOfStock ? 0 : qty}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('increaseQuantity')}
          disabled={outOfStock || qty >= maxQty}
          onClick={() => setQty((prev) => Math.min(maxQty, prev + 1))}
          className="rounded-lg"
        >
          +
        </Button>
      </div>
      {/* Confident CTA: taller rounded-lg CTA; text node stays t('addToCart')
          ('Ajouter au panier') and onAdd still ends in openDrawer(). */}
      <Button
        type="button"
        size="lg"
        disabled={outOfStock}
        onClick={onAdd}
        className="h-12 w-full rounded-lg px-10 text-sm font-semibold tracking-wide uppercase shadow-sm sm:w-auto"
      >
        {outOfStock ? t('outOfStock') : t('addToCart')}
      </Button>
    </div>
  );
}
