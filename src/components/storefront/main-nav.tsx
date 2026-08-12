'use client';

import {ChevronDown} from 'lucide-react';
import {useLocale, useTranslations} from 'next-intl';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {Link, usePathname} from '@/i18n/navigation';
import {cn} from '@/lib/utils';
// Type-only import: erased at compile time, so the server-only module is
// never bundled into this client component.
import type {StorefrontCategoryNode} from '@/server/storefront';

type MainNavProps = {categories: StorefrontCategoryNode[]};

// Mockup header nav (lg+ only — below lg the hamburger sheet covers it):
// Accueil · Boutique · Nouveautés · Meilleures ventes · Catégories ▾ ·
// À propos · Contact, centered between the wordmark and the icon group.
// The Catégories entry is the old category-nav row folded into a single
// Base UI dropdown: one submenu per root with children ("Voir tout" + subs),
// plain links otherwise — every destination is a real /products?cat=&sub=
// filter. Uppercase micro-labels stay FR-only: letter-spacing and uppercase
// are typographic noise for Arabic joined script.
export function MainNav({categories}: MainNavProps) {
  const t = useTranslations('nav');
  const locale = useLocale();
  const pathname = usePathname();
  const isAr = locale === 'ar';

  const name = (node: {nameFr: string; nameAr: string}) => (isAr ? node.nameAr : node.nameFr);
  // Subtle gold underline: grows on hover, pinned open on the active route.
  const itemCls = cn(
    'relative rounded-md px-2.5 py-2 font-medium text-foreground/80 transition-colors hover:text-foreground',
    'after:absolute after:inset-x-2.5 after:bottom-1 after:h-px after:origin-center after:scale-x-0 after:bg-primary after:transition-transform after:duration-200 hover:after:scale-x-100',
    'aria-[current=page]:text-foreground aria-[current=page]:after:scale-x-100',
    isAr ? 'text-sm' : 'text-xs uppercase tracking-[0.14em]'
  );
  // aria-current only where it is cheap: exact pathname matches (query-string
  // and hash destinations are skipped on purpose).
  const current = (href: string) => (pathname === href ? ('page' as const) : undefined);

  return (
    <nav aria-label={t('main')} className="hidden min-w-0 flex-1 lg:block">
      <ul className="flex flex-wrap items-center justify-center gap-0.5">
        <li>
          <Link href="/" aria-current={current('/')} className={itemCls}>
            {t('home')}
          </Link>
        </li>
        <li>
          <Link href="/products" aria-current={current('/products')} className={itemCls}>
            {t('shop')}
          </Link>
        </li>
        <li>
          <Link href="/products?sort=new" className={itemCls}>
            {t('newArrivals')}
          </Link>
        </li>
        <li>
          {/* Anchor to the home best-sellers section — works cross-page. */}
          <Link href="/#meilleures-ventes" className={itemCls}>
            {t('bestSellers')}
          </Link>
        </li>
        {categories.length > 0 && (
          <li>
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  itemCls,
                  'inline-flex items-center gap-1 outline-none data-popup-open:text-foreground data-popup-open:after:scale-x-100'
                )}
              >
                {t('categories')}
                <ChevronDown aria-hidden="true" className="size-3.5 opacity-60" />
              </DropdownMenuTrigger>
              {/* theme-yasmine: the popup portals to <body>, outside the
                  storefront layout wrapper, so it carries the token scope. */}
              <DropdownMenuContent
                align="start"
                sideOffset={8}
                className="theme-yasmine w-auto min-w-48 rounded-lg p-1.5"
              >
                {categories.map((root) => {
                  const rootHref = `/products?cat=${encodeURIComponent(root.slug)}`;
                  if (root.children.length === 0) {
                    return (
                      <DropdownMenuItem key={root.id} render={<Link href={rootHref} />}>
                        {name(root)}
                      </DropdownMenuItem>
                    );
                  }
                  return (
                    <DropdownMenuSub key={root.id}>
                      <DropdownMenuSubTrigger>{name(root)}</DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="theme-yasmine w-auto min-w-44 rounded-lg p-1.5">
                        <DropdownMenuItem render={<Link href={rootHref} />} className="font-medium">
                          {t('viewAll')}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {root.children.map((sub) => (
                          <DropdownMenuItem
                            key={sub.id}
                            render={
                              <Link href={`${rootHref}&sub=${encodeURIComponent(sub.slug)}`} />
                            }
                          >
                            {name(sub)}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        )}
        <li>
          <Link href="/about" aria-current={current('/about')} className={itemCls}>
            {t('about')}
          </Link>
        </li>
        <li>
          <Link href="/contact" aria-current={current('/contact')} className={itemCls}>
            {t('contact')}
          </Link>
        </li>
      </ul>
    </nav>
  );
}
