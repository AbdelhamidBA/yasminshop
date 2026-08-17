'use client';

import {ShoppingBag, X} from 'lucide-react';
import {useLocale, useTranslations} from 'next-intl';
import {useCart} from '@/components/cart/cart-provider';
import {Eyebrow, SlipRow} from '@/components/storefront/brand';
import {Button} from '@/components/ui/button';
import {Sheet, SheetClose, SheetContent} from '@/components/ui/sheet';
import {Link} from '@/i18n/navigation';
import {MAX_QTY, cartCount, cartLineUnitPrice, cartSubtotal} from '@/lib/cart';
import {formatMillimes} from '@/lib/money';

type CartDrawerProps = {
  // Server-provided (Setting.currency) — this client leaf cannot read settings.
  currencyLabel: string;
};

// The "panier" side menu: a slide-over from the inline-end edge, opened by the
// header/bottom-nav cart buttons and after every add-to-cart. It complements —
// never replaces — the /cart page, which stays the full cart + promo-code
// surface ("Voir le panier" leads there, "Commander" straight to checkout).
//
// Design pass: the drawer is the first page of the bon de livraison. Each line
// sets name (semibold) against its line total in the display face and brand
// brown, with the unit price demoted to the utility face underneath; the
// subtotal is a SlipRow so the dotted leader already reads as a receipt before
// the customer reaches the real slip on /cart. All amounts are DISPLAY ONLY
// (add-time effective prices in millimes); checkout re-prices server-side.
export function CartDrawer({currencyLabel}: CartDrawerProps) {
  const t = useTranslations();
  const locale = useLocale();
  const isAr = locale === 'ar';
  const {state, wholesaleMinQty, hydrated, setQty, remove, drawerOpen, setDrawerOpen} =
    useCart();

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
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-lg leading-none font-extrabold">{t('cartDrawer.title')}</h2>
            <Eyebrow tracked={!isAr} className="mt-2 block text-muted-foreground">
              {t('cartDrawer.itemCount', {count: cartCount({items})})}
            </Eyebrow>
          </div>
          <SheetClose
            render={
              <Button variant="ghost" size="icon-sm" aria-label={t('cartDrawer.close')} />
            }
          >
            <X />
          </SheetClose>
        </div>

        {items.length === 0 ? (
          // Empty state: an invitation, not a dead end — the CTA carries the
          // gold so there is exactly one thing to do here.
          <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-12 text-center">
            <span
              aria-hidden="true"
              className="flex size-16 items-center justify-center rounded-lg border border-dashed text-muted-foreground/50"
            >
              <ShoppingBag className="size-7" />
            </span>
            <p className="text-base font-semibold">{t('cart.empty')}</p>
            <Button
              className="h-11 px-6"
              render={<Link href="/products" onClick={close} />}
            >
              {t('cartDrawer.continueShopping')}
            </Button>
          </div>
        ) : (
          <>
            {/* Dotted rules between lines: the same receipt gesture as the
                slip's leaders. */}
            <ul className="flex-1 divide-y divide-dotted overflow-y-auto px-5">
              {items.map((line) => {
                const name = isAr ? line.nameAr : line.nameFr;
                return (
                  <li key={line.productId} className="flex items-start gap-3 py-4">
                    <Link href={`/products/${line.slug}`} onClick={close} className="shrink-0">
                      <img
                        src={line.imageUrl ?? '/placeholder-product.svg'}
                        alt={name}
                        className="size-16 rounded-lg border bg-card object-cover"
                      />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <Link
                          href={`/products/${line.slug}`}
                          onClick={close}
                          className="line-clamp-2 text-sm leading-snug font-semibold hover:underline"
                        >
                          {name}
                        </Link>
                        {/* Line total: the figure the customer is actually
                            weighing, so it gets the display face + brown. */}
                        <span className="shrink-0 text-sm font-extrabold whitespace-nowrap tabular-nums text-(--brand-brown)">
                          {formatMillimes(cartLineUnitPrice(line, wholesaleMinQty) * line.qty)} {currencyLabel}
                        </span>
                      </div>
                      {/* At qty 1 the unit price and the line total are the
                          same figure — print it once. */}
                      {line.qty > 1 && (
                        <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                          {formatMillimes(cartLineUnitPrice(line, wholesaleMinQty))} {currencyLabel} ×{line.qty}
                        </p>
                      )}
                      <div className="mt-2.5 flex items-center gap-2">
                        <div className="flex h-9 items-center rounded-lg border bg-card px-0.5">
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
                            className="w-8 text-center text-sm font-semibold tabular-nums"
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
                  </li>
                );
              })}
            </ul>

            <div className="border-t bg-secondary/40 px-5 py-4">
              <SlipRow
                label={t('cart.subtotal')}
                value={`${formatMillimes(cartSubtotal(state, wholesaleMinQty))} ${currencyLabel}`}
                emphasis
              />
              {/* Honest scope note: delivery + promo math live on /cart and at
                  checkout, not in the drawer. */}
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {t('cartDrawer.note')}
              </p>
              {/* One decisive CTA; "Voir le panier" stays available but reads
                  as the quieter of the two. */}
              <div className="mt-4 flex flex-col items-stretch gap-1">
                <Button
                  className="h-12 w-full text-sm font-semibold shadow-sm"
                  render={<Link href="/checkout" onClick={close} />}
                >
                  {t('cartDrawer.checkout')}
                </Button>
                <Button
                  variant="link"
                  className="h-9 w-full text-muted-foreground hover:text-foreground"
                  render={<Link href="/cart" onClick={close} />}
                >
                  {t('cartDrawer.viewCart')}
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
