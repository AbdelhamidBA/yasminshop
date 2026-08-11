import {getTranslations, setRequestLocale} from 'next-intl/server';
import {ProductCard} from '@/components/storefront/product-card';
import {parseDinarsToMillimes} from '@/lib/money';
import {getMassDiscountPct, getParameters} from '@/server/settings';
import {
  listStorefrontProducts,
  listVisibleCategoryTree,
  type StorefrontSort
} from '@/server/storefront';
import {Filters} from './filters';
import {Pagination} from './pagination';

const PAGE_SIZE = 12;
const SORT_VALUES: StorefrontSort[] = ['new', 'priceAsc', 'priceDesc'];

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

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const outOfStockLabel = tStorefront('outOfStock');

  // Non-page params preserved verbatim by pagination links.
  const preserved: Record<string, string> = {};
  for (const [key, value] of Object.entries({q: first(sp.q), cat, sub, min, max, stock, sort: sortRaw})) {
    if (value) preserved[key] = value;
  }

  const filters = <Filters categories={categories} />;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t('results', {count: total})}</p>

      {/* Mobile: collapsible filters via a plain <details> (no extra deps). */}
      <details className="mt-4 rounded-lg border p-4 lg:hidden">
        <summary className="cursor-pointer select-none text-sm font-medium">
          {t('filters')}
        </summary>
        <div className="mt-4">{filters}</div>
      </details>

      <div className="mt-6 flex items-start gap-8">
        <aside className="hidden w-64 shrink-0 lg:block">{filters}</aside>
        <div className="min-w-0 flex-1">
          {products.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">{t('empty')}</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
          />
        </div>
      </div>
    </div>
  );
}
