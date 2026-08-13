import type {ReactNode} from 'react';
import {X} from 'lucide-react';
import {getTranslations} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {parseDinarsToMillimes} from '@/lib/money';
// Type-only import (this is a server component either way).
import type {StorefrontCategoryNode} from '@/server/storefront';

type Chip = {key: string; node: ReactNode; text: string; href: string};

type ActiveFiltersProps = {
  /** The non-page query params the catalog page preserves, verbatim. */
  params: Record<string, string>;
  categories: StorefrontCategoryNode[];
  /** `/products` plus the sort param, i.e. every filter removed. */
  clearHref: string;
  /**
   * False when the listing came back empty — the empty state then owns the
   * single decisive "clear" CTA and this row must not echo it.
   */
  showClear: boolean;
  locale: string;
};

/**
 * Removable chips for the filters that are GENUINELY applied — each one
 * mirrors exactly what the catalog page hands to listStorefrontProducts, so
 * a category slug that matches nothing visible, an unparsable price or
 * `stock` set to anything but `1` produce no chip (they are not filtering).
 *
 * Plain <Link>s rather than client state: removing a filter is a navigation,
 * it works without JS, and the state stays legible and reversible.
 */
export async function ActiveFilters({
  params,
  categories,
  clearHref,
  showClear,
  locale
}: ActiveFiltersProps) {
  const t = await getTranslations('catalog');
  const isAr = locale === 'ar';
  const name = (node: {nameFr: string; nameAr: string}) =>
    isAr ? node.nameAr : node.nameFr;

  const hrefWithout = (...keys: string[]) => {
    const search = new URLSearchParams(params);
    for (const key of keys) search.delete(key);
    return `/products${search.size ? `?${search}` : ''}`;
  };

  const chips: Chip[] = [];

  const q = params.q?.trim();
  if (q) {
    chips.push({key: 'q', node: `“${q}”`, text: q, href: hrefWithout('q')});
  }

  // Category/subcategory chips carry the real names from the visible tree.
  const root = params.cat
    ? categories.find((node) => node.slug === params.cat)
    : undefined;
  if (root) {
    // Dropping the parent drops the child with it — a subcategory chip must
    // never outlive the category it hangs from.
    chips.push({
      key: 'cat',
      node: name(root),
      text: name(root),
      href: hrefWithout('cat', 'sub')
    });
  }
  const child = params.sub
    ? (root?.children ?? categories.flatMap((node) => node.children)).find(
        (node) => node.slug === params.sub
      )
    : undefined;
  if (child) {
    chips.push({
      key: 'sub',
      node: name(child),
      text: name(child),
      href: hrefWithout('sub')
    });
  }

  // Only a price the server actually parsed is a filter; one chip covers the
  // bound(s) because min and max are set together by one form.
  const min = params.min && parseDinarsToMillimes(params.min) !== null ? params.min : undefined;
  const max = params.max && parseDinarsToMillimes(params.max) !== null ? params.max : undefined;
  if (min || max) {
    const range = min && max ? `${min} – ${max}` : min ? `≥ ${min}` : `≤ ${max}`;
    chips.push({
      key: 'price',
      node: (
        <>
          {t('price')}{' '}
          {/* Latin digits and the range dash stay LTR inside Arabic text. */}
          <span dir="ltr" className="tabular-nums">
            {range}
          </span>
        </>
      ),
      text: `${t('price')} ${range}`,
      href: hrefWithout('min', 'max')
    });
  }

  if (params.stock === '1') {
    chips.push({
      key: 'stock',
      node: t('inStockOnly'),
      text: t('inStockOnly'),
      href: hrefWithout('stock')
    });
  }

  if (chips.length === 0) return null;

  // Labelled for assistive tech but NOT captioned on screen: the mobile
  // filter disclosure right below already carries the word "Filtres", and the
  // chips plus the clear link say what they are on sight.
  return (
    <nav aria-label={t('filters')} className="mt-5 flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <Link
          key={chip.key}
          href={chip.href}
          aria-label={t('removeFilter', {label: chip.text})}
          className="group/chip inline-flex max-w-full items-center gap-1.5 rounded-lg border bg-card py-1.5 pe-2 ps-3 text-xs font-medium transition-colors hover:border-(--primary-deep) hover:text-(--brand-brown) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span className="truncate">{chip.node}</span>
          <X
            aria-hidden="true"
            className="size-3.5 shrink-0 text-muted-foreground transition-colors group-hover/chip:text-(--primary-deep)"
          />
        </Link>
      ))}
      {showClear && (
        <Link
          href={clearHref}
          className="ms-1 rounded-sm text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {t('clear')}
        </Link>
      )}
    </nav>
  );
}
