import {getTranslations, setRequestLocale} from 'next-intl/server';
import {ProductCard} from '@/components/storefront/product-card';
import {Link} from '@/i18n/navigation';
import {getMassDiscountPct, getParameters} from '@/server/settings';
import {getHomeSections} from '@/server/storefront';

export default async function HomePage({
  params
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const [t, tStorefront, parameters, massDiscountPct] = await Promise.all([
    getTranslations('home'),
    getTranslations('storefront'),
    getParameters(),
    getMassDiscountPct()
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

  return (
    <>
      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:py-16">
        <h1 className="text-3xl font-bold sm:text-4xl">{t('heroTitle')}</h1>
        <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
          {t('heroSubtitle')}
        </p>
        <Link
          href="/products"
          className="mt-6 inline-flex h-10 items-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {t('cta')}
        </Link>
      </section>
      {sections.map(({key, products}) =>
        products.length > 0 ? (
          <section key={key} className="mx-auto w-full max-w-6xl px-4 pb-12">
            <h2 className="mb-4 text-xl font-semibold">{t(`sections.${key}`)}</h2>
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
