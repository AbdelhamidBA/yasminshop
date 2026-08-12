'use client';

import {useId, useState} from 'react';
import {useTranslations} from 'next-intl';
import {toast} from 'sonner';
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
  const {add} = useCart();
  const labelId = useId();
  const [qty, setQty] = useState(1);

  const outOfStock = quantity === 0;
  const maxQty = Math.min(MAX_QTY, quantity);

  function onAdd() {
    add({productId, slug, nameFr, nameAr, unitPriceMillimes, imageUrl}, qty);
    toast.success(t('addedToCart'));
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <span id={labelId} className="text-sm font-medium">
        {t('quantity')}
      </span>
      <div
        role="group"
        aria-labelledby={labelId}
        className="flex items-center rounded-lg border bg-card"
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={outOfStock || qty <= 1}
          onClick={() => setQty((prev) => Math.max(1, prev - 1))}
        >
          −
        </Button>
        <span aria-live="polite" className="w-10 text-center text-sm font-medium tabular-nums">
          {outOfStock ? 0 : qty}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={outOfStock || qty >= maxQty}
          onClick={() => setQty((prev) => Math.min(maxQty, prev + 1))}
        >
          +
        </Button>
      </div>
      <Button
        type="button"
        size="lg"
        disabled={outOfStock}
        onClick={onAdd}
        className="h-11 w-full px-8 text-sm font-semibold tracking-wide uppercase sm:w-auto"
      >
        {outOfStock ? t('outOfStock') : t('addToCart')}
      </Button>
    </div>
  );
}
