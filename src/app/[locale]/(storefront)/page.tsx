import {getTranslations, setRequestLocale} from 'next-intl/server';
import {ArrowRight} from 'lucide-react';
import {ProductCard} from '@/components/storefront/product-card';
import {SectionHeader} from '@/components/storefront/section-header';
import {Link} from '@/i18n/navigation';
import {cn} from '@/lib/utils';
import {getMassDiscountPct, getParameters} from '@/server/settings';
import {getHomeSections, listVisibleCategoryTree} from '@/server/storefront';

export default async function HomePage({
  params
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const [t, tStorefront, parameters, massDiscountPct, categories] = await Promise.all([
    getTranslations('home'),
    getTranslations('storefront'),
    getParameters(),
    getMassDiscountPct(),
    listVisibleCategoryTree()
  ]);
  const {bestSellers, newest, lastChance, mostSearched} = await getHomeSections(
    parameters.lastChanceThreshold
  );

  // Section order per the redesign brief (§3). Every "Voir tout" links to
  // /products: the catalog's searchParams (q/cat/sub/min/max/stock/sort/page)
  // offer no filter that matches a section's semantics (stock=1 means "in
  // stock", not "last chance"), so no section pretends to have one.
  const sections = [
    {key: 'bestSellers', products: bestSellers},
    {key: 'newest', products: newest},
    {key: 'lastChance', products: lastChance},
    {key: 'mostSearched', products: mostSearched}
  ] as const;

  const currencyLabel = parameters.currency;
  const outOfStockLabel = tStorefront('outOfStock');
  const isAr = locale === 'ar';

  return (
    <>
      {/* STATIC HERO (Phase 8) — a single promotional section, deliberately
          NOT a carousel: no arrows, dots, slides or autoplay. Editorial serif
          headline on the cream token, gold CTA to the catalog, and the brand
          flat-lay photo on the inline-end side (its own cream backdrop blends
          into --background in light mode; the rounded container keeps it
          looking intentional on the dark theme's brown surfaces). */}
      <section className="border-b">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-8 px-4 py-10 sm:py-14 lg:grid-cols-2 lg:gap-12 lg:py-16">
          <div className="max-w-xl">
            <h1 className="font-serif text-4xl font-semibold leading-tight tracking-tight text-balance sm:text-5xl">
              {t('heroTitle')}
            </h1>
            <p className="mt-5 max-w-md text-lg text-muted-foreground">
              {t('heroSubtitle')}
            </p>
            <Link
              href="/products"
              className={cn(
                'mt-8 inline-flex h-12 items-center gap-2 rounded-lg bg-primary px-8 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-(--primary-deep)',
                // Uppercase + tracking is FR-only: letter-spacing breaks the
                // joined Arabic script.
                !isAr && 'uppercase tracking-[0.12em]'
              )}
            >
              {t('cta')}
              <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden="true" />
            </Link>
          </div>
          <div className="overflow-hidden rounded-3xl">
            {/* Decorative brand imagery — the text block carries the message. */}
            <img
              src="/brand/hero.webp"
              alt=""
              fetchPriority="high"
              className="aspect-[16/9] w-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* BROWSE BY CATEGORIES — data-driven pill row directly below the hero:
          [Toutes → /products] + the real visible root categories. Scrolls
          horizontally on mobile (never wraps, never overflows the page) and
          wraps centered on sm+. Hidden entirely when no category exists. */}
      {categories.length > 0 && (
        <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:py-12">
          <h2
            className={cn(
              'text-center text-xl font-semibold sm:text-2xl',
              !isAr && 'uppercase tracking-[0.14em]'
            )}
          >
            {t('categoriesTitle')}
          </h2>
          <div className="mt-6 flex items-center gap-2.5 overflow-x-auto pb-2 sm:flex-wrap sm:justify-center sm:overflow-visible sm:pb-0">
            <Link
              href="/products"
              className="shrink-0 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-(--primary-deep)"
            >
              {t('allCategories')}
            </Link>
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/products?cat=${encodeURIComponent(category.slug)}`}
                className="shrink-0 rounded-full bg-secondary px-5 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:bg-primary focus-visible:text-primary-foreground"
              >
                {isAr ? category.nameAr : category.nameFr}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* FULL-WIDTH PRODUCT GRID SECTIONS (spec §6/§13) — no embla on the
          home page anymore: plain responsive grids, 2/row on mobile (cards
          stay comfortable ≈170px wide), 3/row on tablet, 4/row from lg.
          Empty sections hide entirely (§18 — never fake placeholders); the
          last section sits directly above the footer (§3/§7, no promotional
          service strip in between). */}
      {sections.map(({key, products}) =>
        products.length > 0 ? (
          <section
            key={key}
            aria-label={t(`sections.${key}`)}
            className="mx-auto w-full max-w-6xl px-4 pb-14 sm:pb-16"
          >
            <SectionHeader
              title={t(`sections.${key}`)}
              href="/products"
              linkLabel={t('viewAll')}
              uppercase={!isAr}
            />
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  locale={locale}
                  massDiscountPct={massDiscountPct}
                  currencyLabel={currencyLabel}
                  outOfStockLabel={outOfStockLabel}
                />
              ))}
            </div>
          </section>
        ) : null
      )}
    </>
  );
}
