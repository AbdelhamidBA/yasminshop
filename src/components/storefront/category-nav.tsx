'use client';

import {ChevronDown} from 'lucide-react';
import {useLocale, useTranslations} from 'next-intl';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {Link} from '@/i18n/navigation';
import {cn} from '@/lib/utils';
// Type-only import: erased at compile time, so the server-only module is
// never bundled into this client component.
import type {StorefrontCategoryNode} from '@/server/storefront';

type CategoryNavProps = {categories: StorefrontCategoryNode[]};

// Desktop category nav row under the logo row (karina-style): Accueil +
// Produits links, then one entry per visible root category — a Base UI
// dropdown ("Voir tout" + subcategories) when the root has children, a plain
// link otherwise. Uppercase micro-labels are FR-only: letter-spacing and
// uppercase are typographic noise for Arabic joined script.
export function CategoryNav({categories}: CategoryNavProps) {
  const t = useTranslations('nav');
  const locale = useLocale();
  const isAr = locale === 'ar';

  const name = (node: {nameFr: string; nameAr: string}) => (isAr ? node.nameAr : node.nameFr);
  const itemCls = cn(
    'rounded-lg px-3 py-2 font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-foreground',
    isAr ? 'text-sm' : 'text-xs uppercase tracking-[0.14em]'
  );

  return (
    <nav aria-label={t('main')} className="hidden border-t md:block">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-1 px-4 py-1">
        <Link href="/" className={itemCls}>
          {t('home')}
        </Link>
        <Link href="/products" className={itemCls}>
          {t('products')}
        </Link>
        {categories.map((root) => {
          const rootHref = `/products?cat=${encodeURIComponent(root.slug)}`;
          if (root.children.length === 0) {
            return (
              <Link key={root.id} href={rootHref} className={itemCls}>
                {name(root)}
              </Link>
            );
          }
          return (
            <DropdownMenu key={root.id}>
              <DropdownMenuTrigger
                className={cn(
                  itemCls,
                  'inline-flex items-center gap-1 outline-none data-popup-open:bg-accent data-popup-open:text-foreground'
                )}
              >
                {name(root)}
                <ChevronDown aria-hidden="true" className="size-3.5 opacity-60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" sideOffset={8} className="w-auto min-w-48 rounded-xl p-1.5">
                <DropdownMenuItem render={<Link href={rootHref} />} className="font-medium">
                  {t('viewAll')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {root.children.map((sub) => (
                  <DropdownMenuItem
                    key={sub.id}
                    render={
                      <Link
                        href={`${rootHref}&sub=${encodeURIComponent(sub.slug)}`}
                      />
                    }
                  >
                    {name(sub)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        })}
      </div>
    </nav>
  );
}
