'use client';

import {useState} from 'react';
import {Menu, X} from 'lucide-react';
import {useLocale, useTranslations} from 'next-intl';
import {Button} from '@/components/ui/button';
import {Sheet, SheetClose, SheetContent} from '@/components/ui/sheet';
import {Link} from '@/i18n/navigation';
import {cn} from '@/lib/utils';
// Type-only import: erased at compile time, so the server-only module is
// never bundled into this client component.
import type {StorefrontCategoryNode} from '@/server/storefront';

type MobileMenuProps = {categories: StorefrontCategoryNode[]};

// Mobile menu (lg:hidden trigger — the desktop nav links take over at lg): a
// sheet from the inline-start edge with the main links (mirroring the desktop
// nav: home, shop, new arrivals, best sellers, about, contact) and the full
// category tree as an indented list — every entry is a real destination.
// Links close the sheet on click since client-side navigation keeps the
// layout (and this state) mounted.
export function MobileMenu({categories}: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const tNav = useTranslations('nav');
  // Root-scoped for the shared close label (cartDrawer.close = "Fermer").
  const t = useTranslations();
  const locale = useLocale();
  const isAr = locale === 'ar';

  const name = (node: {nameFr: string; nameAr: string}) => (isAr ? node.nameAr : node.nameFr);
  const close = () => setOpen(false);
  const linkCls = 'block rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-accent';

  return (
    <>
      <button
        type="button"
        aria-label={tNav('menu')}
        onClick={() => setOpen(true)}
        className="flex size-9 shrink-0 items-center justify-center rounded-md border hover:bg-accent lg:hidden"
      >
        <Menu className="size-4" />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        {/* theme-yasmine: the sheet portals to <body>, outside the storefront
            layout wrapper, so it carries the brand token scope itself. */}
        <SheetContent side="start" aria-label={tNav('menu')} className="theme-yasmine max-w-[85%] sm:max-w-xs">
          <div className="flex items-center justify-between gap-4 border-b px-5 py-4">
            <h2 className="font-heading text-base font-semibold">{tNav('menu')}</h2>
            <SheetClose
              render={<Button variant="ghost" size="icon-sm" aria-label={t('cartDrawer.close')} />}
            >
              <X />
            </SheetClose>
          </div>
          <nav className="flex-1 overflow-y-auto p-3">
            <Link href="/" onClick={close} className={linkCls}>
              {tNav('home')}
            </Link>
            <Link href="/products" onClick={close} className={linkCls}>
              {tNav('shop')}
            </Link>
            <Link href="/products?sort=new" onClick={close} className={linkCls}>
              {tNav('newArrivals')}
            </Link>
            <Link href="/#meilleures-ventes" onClick={close} className={linkCls}>
              {tNav('bestSellers')}
            </Link>
            <p
              className={cn(
                'mt-4 px-3 text-[11px] font-semibold text-muted-foreground',
                !isAr && 'uppercase tracking-widest'
              )}
            >
              {tNav('categories')}
            </p>
            <ul className="mt-1">
              {categories.map((root) => {
                const rootHref = `/products?cat=${encodeURIComponent(root.slug)}`;
                return (
                  <li key={root.id}>
                    <Link href={rootHref} onClick={close} className={linkCls}>
                      {name(root)}
                    </Link>
                    {root.children.length > 0 && (
                      <ul className="ms-4 border-s ps-1">
                        {root.children.map((sub) => (
                          <li key={sub.id}>
                            <Link
                              href={`${rootHref}&sub=${encodeURIComponent(sub.slug)}`}
                              onClick={close}
                              className="block rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                            >
                              {name(sub)}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 border-t pt-3">
              <Link href="/about" onClick={close} className={linkCls}>
                {tNav('about')}
              </Link>
              <Link href="/contact" onClick={close} className={linkCls}>
                {tNav('contact')}
              </Link>
            </div>
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
