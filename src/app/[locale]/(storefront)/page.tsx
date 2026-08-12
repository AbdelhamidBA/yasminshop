import {getTranslations, setRequestLocale} from 'next-intl/server';
import {ArrowRight} from 'lucide-react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious
} from '@/components/ui/carousel';
import {ProductCard} from '@/components/storefront/product-card';
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
  const {newest, featured, lastChance, mostSearched} = await getHomeSections(
    parameters.lastChanceThreshold
  );

  const sections = [
    {key: 'newest', products: newest},
    {key: 'featured', products: featured},
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

      {/* PRODUCT SECTION CAROUSELS — below xl an embla strip with edge peek;
          at xl+ embla deactivates (`active: false`) and the same children lay
          out as the familiar 4-column grid, so all cards stay visible and
          clickable at desktop widths (the e2e viewport is 1280px). */}
      {sections.map(({key, products}) =>
        products.length > 0 ? (
          <section key={key} className="mx-auto w-full max-w-6xl px-4 pb-14">
            <div className="mb-5 flex items-end justify-between gap-4">
              <h2 className="text-2xl font-bold tracking-tight">
                {t(`sections.${key}`)}
              </h2>
              <Link
                href="/products"
                className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
              >
                {t('viewAll')}
                <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden="true" />
              </Link>
            </div>
            <Carousel
              aria-label={t(`sections.${key}`)}
              opts={{
                align: 'start',
                slidesToScroll: 'auto',
                breakpoints: {'(min-width: 1280px)': {active: false}}
              }}
            >
              <CarouselContent
                viewportClassName="-my-2 py-2 xl:overflow-visible"
                className="-ms-4 xl:ms-0 xl:grid xl:grid-cols-4 xl:gap-4"
              >
                {products.map((product) => (
                  <CarouselItem
                    key={product.id}
                    className="basis-[78%] ps-4 sm:basis-[46%] md:basis-1/3 lg:basis-[29.5%] xl:basis-auto xl:ps-0"
                  >
                    <ProductCard
                      product={product}
                      locale={locale}
                      massDiscountPct={massDiscountPct}
                      currencyLabel={currencyLabel}
                      outOfStockLabel={outOfStockLabel}
                    />
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="absolute -start-3 top-1/2 -translate-y-1/2 xl:hidden" />
              <CarouselNext className="absolute -end-3 top-1/2 -translate-y-1/2 xl:hidden" />
            </Carousel>
          </section>
        ) : null
      )}
    </>
  );
}
