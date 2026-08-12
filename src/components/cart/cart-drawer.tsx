'use client';

import {ShoppingBag, X} from 'lucide-react';
import {useLocale, useTranslations} from 'next-intl';
import {useCart} from '@/components/cart/cart-provider';
import {Button} from '@/components/ui/button';
import {Sheet, SheetClose, SheetContent} from '@/components/ui/sheet';
import {Link} from '@/i18n/navigation';
import {cartSubtotal, MAX_QTY} from '@/lib/cart';
import {formatMillimes} from '@/lib/money';

type CartDrawerProps = {
  // Server-provided (Setting.currency) — this client leaf cannot read settings.
  currencyLabel: string;
};

// The "panier" side menu (Phase 7): a slide-over from the inline-end edge,
// opened by the header/bottom-nav cart buttons and after every add-to-cart.
// It complements — never replaces — the /cart page, which stays the full cart
// + promo-code surface ("Voir le panier" leads there, "Commander" straight to
// checkout). All amounts are DISPLAY ONLY (add-time effective prices in
// millimes); checkout re-prices server-side.
export function CartDrawer({currencyLabel}: CartDrawerProps) {
  const t = useTranslations();
  const locale = useLocale();
  const {state, hydrated, setQty, remove, drawerOpen, setDrawerOpen} = useCart();

  const close = () => setDrawerOpen(false);
  // Before hydration the provider still holds the empty server cart; the
  // drawer can only be opened by a user action (which happens post-hydration),
  // but guard anyway so a stale open state can never show a wrong cart.
  const items = hydrated ? state.items : [];

  return (
    <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
      {/* Portalled to <body>, outside the storefront layout wrapper — carries
          the theme-yasmine token scope itself. */}
      <SheetContent side="end" aria-label={t('cartDrawer.title')} className="theme-yasmine">
        <div className="flex items-center justify-between gap-4 border-b px-5 py-4">
          <h2 className="font-heading text-base font-semibold">{t('cartDrawer.title')}</h2>
          <SheetClose
            render={
              <Button variant="ghost" size="icon-sm" aria-label={t('cartDrawer.close')} />
            }
          >
            <X />
          </SheetClose>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-5 py-10 text-center">
            <ShoppingBag className="size-10 text-muted-foreground/40" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">{t('cart.empty')}</p>
            <Button variant="outline" render={<Link href="/products" onClick={close} />}>
              {t('cartDrawer.continueShopping')}
            </Button>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y overflow-y-auto px-5">
              {items.map((line) => {
                const name = locale === 'ar' ? line.nameAr : line.nameFr;
                return (
                  <li key={line.productId} className="flex items-start gap-3 py-4">
                    <Link href={`/products/${line.slug}`} onClick={close} className="shrink-0">
                      <img
                        src={line.imageUrl ?? '/placeholder-product.svg'}
                        alt={name}
                        className="size-16 rounded-lg border object-cover"
                      />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/products/${line.slug}`}
                        onClick={close}
                        className="line-clamp-2 text-sm font-medium hover:underline"
                      >
                        {name}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatMillimes(line.unitPriceMillimes)} {currencyLabel}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex items-center rounded-lg border">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t('product.decreaseQuantity')}
                            disabled={line.qty <= 1}
                            onClick={() => setQty(line.productId, line.qty - 1)}
                          >
                            −
                          </Button>
                          <span
                            aria-live="polite"
                            className="w-7 text-center text-sm tabular-nums"
                          >
                            {line.qty}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t('product.increaseQuantity')}
                            disabled={line.qty >= MAX_QTY}
                            onClick={() => setQty(line.productId, line.qty + 1)}
                          >
                            +
                          </Button>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t('cart.remove')}
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => remove(line.productId)}
                        >
                          <X />
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm font-semibold whitespace-nowrap tabular-nums">
                      {formatMillimes(line.unitPriceMillimes * line.qty)} {currencyLabel}
                    </p>
                  </li>
                );
              })}
            </ul>

            <div className="border-t bg-muted/30 px-5 py-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('cart.subtotal')}</span>
                <span className="font-semibold tabular-nums">
                  {formatMillimes(cartSubtotal(state))} {currencyLabel}
                </span>
              </div>
              {/* Honest scope note: delivery + promo math live on /cart and at
                  checkout, not in the drawer. */}
              <p className="mt-1 text-xs text-muted-foreground">{t('cartDrawer.note')}</p>
              <div className="mt-4 grid gap-2">
                <Button variant="outline" render={<Link href="/cart" onClick={close} />}>
                  {t('cartDrawer.viewCart')}
                </Button>
                <Button render={<Link href="/checkout" onClick={close} />}>
                  {t('cartDrawer.checkout')}
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
