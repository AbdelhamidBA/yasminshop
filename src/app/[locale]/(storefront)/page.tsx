import {getTranslations, setRequestLocale} from 'next-intl/server';
import {ArrowRight} from 'lucide-react';
import {
  Carousel,
  CarouselContent,
  CarouselDots,
  CarouselItem,
  CarouselNext,
  CarouselPrevious
} from '@/components/ui/carousel';
import {ProductCard} from '@/components/storefront/product-card';
import {Price} from '@/components/storefront/price';
import {TrustBadges} from '@/components/storefront/trust-badges';
import {Link} from '@/i18n/navigation';
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

  // Hero slides use REAL products only — no fabricated promos/imagery. Slide 1
  // is the brand slide (keeps heroTitle/heroSubtitle/cta + a decorative
  // collage of the newest arrivals); the next slides showcase featured
  // products (newest as fallback) with their real price and a CTA to the
  // product page. CTA text stays generic ("view the product") so no hero link
  // ever shares an accessible name with the product-card links below — the
  // e2e first()-card locators must keep resolving to the section cards.
  const collageProducts = newest.slice(0, 4);
  const heroSlideProducts = (featured.length > 0 ? featured : newest).slice(0, 3);

  return (
    <>
      {/* HERO CAROUSEL */}
      <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
        <Carousel
          aria-label={t('heroCarouselLabel')}
          autoplayDelay={5000}
          opts={{loop: true}}
        >
          <CarouselContent className="-ms-4">
            {/* Slide 1 — brand */}
            <CarouselItem className="ps-4">
              <div className="grid h-full items-center gap-8 overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/10 via-card to-card p-6 pb-14 sm:p-10 sm:pb-14 lg:grid-cols-2 lg:gap-10">
                <div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                    {t('heroEyebrow')}
                  </span>
                  <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
                    {t('heroTitle')}
                  </h1>
                  <p className="mt-4 max-w-md text-lg text-muted-foreground">
                    {t('heroSubtitle')}
                  </p>
                  <Link
                    href="/products"
                    className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-primary px-8 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                  >
                    {t('cta')}
                    <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden="true" />
                  </Link>
                </div>
                {collageProducts.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 sm:gap-4" aria-hidden="true">
                    {collageProducts.map((product) => {
                      const name = locale === 'ar' ? product.nameAr : product.nameFr;
                      const imageUrl =
                        product.images[0]?.url ?? '/placeholder-product.svg';
                      return (
                        <div
                          key={product.id}
                          className="relative overflow-hidden rounded-2xl border bg-card shadow-sm"
                        >
                          <img
                            src={imageUrl}
                            alt=""
                            loading="lazy"
                            className="aspect-square w-full object-cover"
                          />
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/95 via-background/70 to-transparent p-3 pt-8">
                            <p className="truncate text-xs font-medium">{name}</p>
                            <div className="text-sm">
                              <Price
                                priceMillimes={product.priceMillimes}
                                discountPct={product.discountPct}
                                massDiscountPct={massDiscountPct}
                                currencyLabel={currencyLabel}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </CarouselItem>

            {/* Product slides — real featured/newest products, honest copy */}
            {heroSlideProducts.map((product) => {
              const name = locale === 'ar' ? product.nameAr : product.nameFr;
              const imageUrl = product.images[0]?.url ?? '/placeholder-product.svg';
              return (
                <CarouselItem key={product.id} className="ps-4">
                  <div className="grid h-full items-center gap-8 overflow-hidden rounded-3xl border bg-gradient-to-br from-secondary via-card to-card p-6 pb-14 sm:p-10 sm:pb-14 lg:grid-cols-2 lg:gap-10">
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        {t('heroSelection')}
                      </span>
                      {/* Big type, but NOT a heading: hidden slides must not
                          clutter the outline or heading locators. */}
                      <p className="mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
                        {name}
                      </p>
                      <div className="mt-4 text-xl sm:text-2xl">
                        <Price
                          priceMillimes={product.priceMillimes}
                          discountPct={product.discountPct}
                          massDiscountPct={massDiscountPct}
                          currencyLabel={currencyLabel}
                        />
                      </div>
                      <Link
                        href={`/products/${product.slug}`}
                        className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-primary px-8 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                      >
                        {t('heroViewProduct')}
                        <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden="true" />
                      </Link>
                    </div>
                    <img
                      src={imageUrl}
                      alt=""
                      loading="lazy"
                      className="aspect-[4/3] w-full rounded-2xl border object-cover shadow-sm"
                    />
                  </div>
                </CarouselItem>
              );
            })}
          </CarouselContent>
          <CarouselPrevious className="absolute start-4 top-1/2 hidden -translate-y-1/2 sm:inline-flex" />
          <CarouselNext className="absolute end-4 top-1/2 hidden -translate-y-1/2 sm:inline-flex" />
          <CarouselDots className="absolute inset-x-0 bottom-4" />
        </Carousel>
      </section>

      {/* TRUST BADGES */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-4">
        <div className="rounded-2xl border bg-card px-6 py-5">
          <TrustBadges />
        </div>
      </section>

      {/* SHOP BY CATEGORIES */}
      {categories.length > 0 && (
        <section className="mx-auto w-full max-w-6xl px-4 py-10">
          <div className="mb-1 flex items-end justify-between gap-4">
            <h2 className="text-2xl font-bold tracking-tight">
              {t('categoriesTitle')}
            </h2>
          </div>
          <p className="mb-5 text-sm text-muted-foreground">
            {t('categoriesSubtitle')}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {categories.map((category) => {
              const name = locale === 'ar' ? category.nameAr : category.nameFr;
              return (
                <Link
                  key={category.id}
                  href={`/products?cat=${category.slug}`}
                  className="group flex flex-col justify-between gap-6 rounded-2xl border bg-gradient-to-br from-muted/60 to-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:from-primary/10 hover:shadow-sm"
                >
                  <span className="line-clamp-2 text-sm font-semibold">{name}</span>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground group-hover:text-primary">
                    {t('shopNow')}
                    <ArrowRight className="size-3.5 rtl:-scale-x-100" aria-hidden="true" />
                  </span>
                </Link>
              );
            })}
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
