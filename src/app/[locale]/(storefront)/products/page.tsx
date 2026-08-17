import type {Metadata} from 'next';
import {ChevronDown} from 'lucide-react';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {DEFAULT_DESCRIPTION} from '@/lib/seo';
import {Eyebrow} from '@/components/storefront/brand';
import {ProductCard} from '@/components/storefront/product-card';
import {Link} from '@/i18n/navigation';
import {parseDinarsToMillimes} from '@/lib/money';
import {cn} from '@/lib/utils';
import {getMassDiscountPct, getParameters} from '@/server/settings';
import {
  listStorefrontProducts,
  listVisibleCategoryTree,
  type StorefrontSort
} from '@/server/storefront';
import {ActiveFilters} from './active-filters';
import {Filters} from './filters';
import {Pagination} from './pagination';
import {SortSelect} from './sort-select';

// The catalogue is the shop's most valuable indexable page after the home page,
// so it gets its own title and description rather than inheriting the site
// default. It canonicalises to the UNFILTERED listing on purpose: /products,
// /products?sort=priceAsc and /products?page=2 are the same set of goods in a
// different order, and letting each be indexed separately splits the page's
// authority across near-duplicates.
export async function generateMetadata({
  params
}: {
  params: Promise<{locale: string}>;
}): Promise<Metadata> {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: 'catalog'});
  const title = t('title');
  const description = t.has('metaDescription')
    ? t('metaDescription')
    : DEFAULT_DESCRIPTION;
  return {
    title,
    description,
    alternates: {canonical: `/${locale}/products`},
    openGraph: {title, description, url: `/${locale}/products`, type: 'website'}
  };
}

const PAGE_SIZE = 12;
const SORT_VALUES: StorefrontSort[] = ['new', 'priceAsc', 'priceDesc'];
// The params that genuinely narrow the listing (sort orders it, page walks it).
const FILTER_KEYS = ['q', 'cat', 'sub', 'min', 'max', 'stock'] as const;

// URL params can repeat (?min=1&min=2 arrives as an array): only accept a
// plain scalar string, ignore everything else.
function first(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

// Dinars string from the URL → integer millimes; invalid input is ignored.
function toMillimes(value: string | undefined): number | undefined {
  if (!value) return undefined;
  return parseDinarsToMillimes(value) ?? undefined;
}

export default async function CatalogPage({
  params,
  searchParams
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const sp = await searchParams;

  const q = first(sp.q)?.trim() || undefined;
  const cat = first(sp.cat);
  const sub = first(sp.sub);
  const min = first(sp.min);
  const max = first(sp.max);
  const stock = first(sp.stock);
  const sortRaw = first(sp.sort);
  const sort = SORT_VALUES.find((value) => value === sortRaw) ?? 'new';
  const pageRaw = Number(first(sp.page));
  // listStorefrontProducts re-guards (safe int, 1..10 000 cap) — this is just
  // the URL-string → number step.
  const page = Number.isSafeInteger(pageRaw) && pageRaw >= 1 ? pageRaw : 1;

  const [t, tStorefront, categories, parameters, massDiscountPct, {products, total}] =
    await Promise.all([
      getTranslations('catalog'),
      getTranslations('storefront'),
      listVisibleCategoryTree(),
      getParameters(),
      getMassDiscountPct(),
      listStorefrontProducts({
        q,
        categorySlug: cat,
        subCategorySlug: sub,
        minPriceMillimes: toMillimes(min),
        maxPriceMillimes: toMillimes(max),
        inStock: stock === '1' ? true : undefined,
        sort,
        page,
        pageSize: PAGE_SIZE
      })
    ]);

  const isAr = locale === 'ar';
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const outOfStockLabel = tStorefront('outOfStock');

  // Non-page params preserved verbatim by pagination links and chip removals.
  const preserved: Record<string, string> = {};
  for (const [key, value] of Object.entries({
    q: first(sp.q),
    cat,
    sub,
    min,
    max,
    stock,
    sort: sortRaw
  })) {
    if (value) preserved[key] = value;
  }
  const hasActiveFilter = FILTER_KEYS.some((key) => preserved[key] !== undefined);
  // Clearing keeps the ordering — sort is not a filter.
  const clearHref = sort === 'new' ? '/products' : `/products?sort=${sort}`;

  // The meta line names where the reader is standing, using the real visible
  // tree — an unknown slug names nothing rather than echoing the URL back.
  const activeRoot = cat ? categories.find((node) => node.slug === cat) : undefined;
  const activeChild = sub
    ? (activeRoot?.children ?? categories.flatMap((node) => node.children)).find(
        (node) => node.slug === sub
      )
    : undefined;
  const activeNode = activeChild ?? activeRoot;
  const contextName = activeNode ? (isAr ? activeNode.nameAr : activeNode.nameFr) : null;

  const filters = <Filters categories={categories} />;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-10">
      {/* RESULT HEADER — the count is meta, set in the utility face above the
          title, not a stray line floating opposite it. The title stays the
          page's identity; the category the reader picked qualifies the count. */}
      <header>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-muted-foreground">
          <Eyebrow tracked={!isAr}>{t('results', {count: total})}</Eyebrow>
          {contextName !== null && (
            <>
              <span aria-hidden="true" className="h-3 w-px bg-border" />
              <Eyebrow tracked={!isAr} className="text-(--brand-brown)">
                {contextName}
              </Eyebrow>
            </>
          )}
        </p>
        <h1 className="mt-3 text-3xl leading-none font-extrabold text-balance sm:text-4xl">
          {t('title')}
        </h1>
      </header>

      <ActiveFilters
        params={preserved}
        categories={categories}
        clearHref={clearHref}
        showClear={products.length > 0}
        locale={locale}
      />

      <div aria-hidden="true" className="mt-6 h-px bg-border" />

      {/* Mobile: the rail folds into a disclosure strip — same paper surface,
          a dotted rule where it opens, and the native marker replaced by a
          chevron that turns. */}
      <details className="group mt-6 rounded-lg border bg-card lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-4 py-3.5 text-muted-foreground select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
          <Eyebrow tracked={!isAr}>{t('filters')}</Eyebrow>
          <ChevronDown
            aria-hidden="true"
            className="size-4 shrink-0 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
          />
        </summary>
        <div className="border-t border-dotted px-4 pt-5 pb-5">{filters}</div>
      </details>

      <div className="mt-6 flex items-start gap-8 lg:mt-8 lg:gap-12">
        <aside className="hidden w-64 shrink-0 lg:sticky lg:top-24 lg:block">
          {/* A quiet paper panel: hairline, no shadow, generous air. It scrolls
              inside itself if the category tree ever outgrows the viewport, so
              the bottom of the rail is always reachable. */}
          <div className="max-h-[calc(100svh-8rem)] overflow-y-auto overscroll-contain rounded-lg border bg-card/60 px-5 py-6">
            {filters}
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mb-5 flex items-center justify-end sm:mb-6">
            <SortSelect />
          </div>

          {products.length === 0 ? (
            // An invitation, not an apology: the state in the display role,
            // one sentence of guidance, one decisive way back.
            <div className="flex flex-col items-center rounded-lg border border-dashed px-6 py-16 text-center sm:py-20">
              <p className="text-2xl leading-tight font-extrabold text-balance sm:text-3xl">
                {t('empty')}
              </p>
              {hasActiveFilter && (
                <>
                  <p className="mt-4 max-w-[46ch] text-sm leading-[1.75] text-muted-foreground">
                    {t('emptyHint')}
                  </p>
                  <Link
                    href={clearHref}
                    className={cn(
                      'mt-8 inline-flex h-11 items-center rounded-lg bg-primary px-7 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-(--primary-deep) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                      !isAr && 'uppercase tracking-[0.12em]'
                    )}
                  >
                    {t('clear')}
                  </Link>
                </>
              )}
            </div>
          ) : (
            // Same rhythm as the home page grids: 2 / 3 / 4 with matching gaps.
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  locale={locale}
                  massDiscountPct={massDiscountPct}
                  currencyLabel={parameters.currency}
                  outOfStockLabel={outOfStockLabel}
                />
              ))}
            </div>
          )}

          <Pagination
            page={page}
            totalPages={totalPages}
            params={preserved}
            prevLabel={t('prev')}
            nextLabel={t('next')}
            tracked={!isAr}
          />
        </div>
      </div>
    </div>
  );
}
