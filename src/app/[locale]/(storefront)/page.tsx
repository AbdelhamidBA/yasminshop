import {getTranslations, setRequestLocale} from 'next-intl/server';
import {ArrowRight} from 'lucide-react';
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

  // Hero collage uses REAL products (featured first, newest as fallback) — no
  // fabricated imagery. Decorative showcase (not links) so it never competes
  // with the actual product-card locators below.
  const heroProducts = (featured.length > 0 ? featured : newest).slice(0, 4);

  return (
    <>
      {/* HERO */}
      <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
        <div className="grid items-center gap-8 overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/10 via-card to-card p-6 sm:p-10 lg:grid-cols-2 lg:gap-10">
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
          {heroProducts.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:gap-4" aria-hidden="true">
              {heroProducts.map((product) => {
                const name = locale === 'ar' ? product.nameAr : product.nameFr;
                const imageUrl = product.images[0]?.url ?? '/placeholder-product.svg';
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
      </section>

      {/* TRUST BADGES */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-4">
        <div className="rounded-2xl border bg-card px-6 py-5">
          <TrustBadges />
        </div>
      </section>

      {/* SHOP BY CATEGORIES */}
      {categories.length > 0 && (
        <section className="mx-auto w-full max-w-6xl px-4 py-8">
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
                  className="group flex flex-col justify-between gap-6 rounded-2xl border bg-gradient-to-br from-muted/60 to-card p-4 transition-colors hover:border-primary/40 hover:from-primary/10"
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

      {/* PRODUCT SECTIONS */}
      {sections.map(({key, products}) =>
        products.length > 0 ? (
          <section key={key} className="mx-auto w-full max-w-6xl px-4 pb-12">
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
