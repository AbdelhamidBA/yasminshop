import {cache} from 'react';
import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {ProductCard} from '@/components/storefront/product-card';
import {Price} from '@/components/storefront/price';
import {Link} from '@/i18n/navigation';
import {effectivePriceMillimes} from '@/lib/money';
import {getMassDiscountPct, getParameters} from '@/server/settings';
import {getRelatedProducts, getStorefrontProduct} from '@/server/storefront';
import {AddToCart} from './add-to-cart';
import {Gallery} from './gallery';

// Dedupes the generateMetadata + page fetches into one query per request.
const getProduct = cache(getStorefrontProduct);

type PageProps = {params: Promise<{locale: string; slug: string}>};

export async function generateMetadata({params}: PageProps): Promise<Metadata> {
  const {locale, slug} = await params;
  const product = await getProduct(slug);
  if (!product) return {};
  const name = locale === 'ar' ? product.nameAr : product.nameFr;
  const description = (
    locale === 'ar' ? product.descriptionAr : product.descriptionFr
  ).slice(0, 160);
  return {title: name, description: description || undefined};
}

export default async function ProductPage({params}: PageProps) {
  const {locale, slug} = await params;
  setRequestLocale(locale);

  const product = await getProduct(slug);
  if (!product) notFound();

  const [t, tBreadcrumb, tCatalog, tStorefront, parameters, massDiscountPct, related] =
    await Promise.all([
      getTranslations('product'),
      getTranslations('breadcrumb'),
      getTranslations('catalog'),
      getTranslations('storefront'),
      getParameters(),
      getMassDiscountPct(),
      getRelatedProducts(product.id, product.categoryId)
    ]);

  const isAr = locale === 'ar';
  const name = isAr ? product.nameAr : product.nameFr;
  const description = isAr ? product.descriptionAr : product.descriptionFr;
  const categoryName = isAr ? product.category.nameAr : product.category.nameFr;
  const subCategoryName = product.subCategory
    ? isAr
      ? product.subCategory.nameAr
      : product.subCategory.nameFr
    : null;

  const categoryHref = `/products?cat=${encodeURIComponent(product.category.slug)}`;
  const subCategoryHref = product.subCategory
    ? `${categoryHref}&sub=${encodeURIComponent(product.subCategory.slug)}`
    : null;

  // Cart line price is the EFFECTIVE price (mass-discount-aware) — display
  // only; checkout re-prices server-side.
  const effective = effectivePriceMillimes(
    product.priceMillimes,
    product.discountPct,
    massDiscountPct
  );

  const stockLine =
    product.quantity === 0 ? (
      <p className="text-sm font-medium text-destructive">{t('outOfStock')}</p>
    ) : product.quantity <= parameters.lastChanceThreshold ? (
      <p className="text-sm font-medium text-destructive">
        {t('lowStock', {count: product.quantity})}
      </p>
    ) : (
      <p className="text-sm text-muted-foreground">{t('inStock')}</p>
    );

  const crumbSeparator = (
    <li aria-hidden="true" className="select-none">
      /
    </li>
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      {/* Breadcrumb: home / category / [subcategory] / product */}
      <nav className="text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <li>
            <Link href="/" className="transition-colors hover:text-foreground">
              {tBreadcrumb('home')}
            </Link>
          </li>
          {crumbSeparator}
          <li>
            <Link href={categoryHref} className="transition-colors hover:text-foreground">
              {categoryName}
            </Link>
          </li>
          {subCategoryName !== null && subCategoryHref !== null && (
            <>
              {crumbSeparator}
              <li>
                <Link
                  href={subCategoryHref}
                  className="transition-colors hover:text-foreground"
                >
                  {subCategoryName}
                </Link>
              </li>
            </>
          )}
          {crumbSeparator}
          <li aria-current="page" className="font-medium text-foreground">
            {name}
          </li>
        </ol>
      </nav>

      {/* Two-column on lg: gallery | info (reference layout) */}
      <div className="mt-6 grid gap-8 lg:grid-cols-2 lg:gap-12">
        <Gallery
          images={product.images.map((image) => ({id: image.id, url: image.url}))}
          name={name}
        />
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{name}</h1>
          <div className="mt-3 text-2xl">
            <Price
              priceMillimes={product.priceMillimes}
              discountPct={product.discountPct}
              massDiscountPct={massDiscountPct}
              currencyLabel={parameters.currency}
            />
          </div>
          <div className="mt-2">{stockLine}</div>
          <p className="mt-5 border-y py-5 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
            {description}
          </p>
          <div className="mt-6">
            <AddToCart
              productId={product.id}
              slug={product.slug}
              nameFr={product.nameFr}
              nameAr={product.nameAr}
              unitPriceMillimes={effective}
              imageUrl={product.images[0]?.url ?? null}
              quantity={product.quantity}
            />
          </div>
          {/* Category/tag line, as in the reference footer of the info column */}
          <p className="mt-8 border-t pt-4 text-sm text-muted-foreground">
            {tCatalog('categories')}:{' '}
            <Link href={categoryHref} className="transition-colors hover:text-foreground">
              {categoryName}
            </Link>
            {subCategoryName !== null && subCategoryHref !== null && (
              <>
                {', '}
                <Link
                  href={subCategoryHref}
                  className="transition-colors hover:text-foreground"
                >
                  {subCategoryName}
                </Link>
              </>
            )}
          </p>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="text-center text-2xl font-semibold">{t('related')}</h2>
          {/* Decorative underline under the centered section title */}
          <div aria-hidden="true" className="mx-auto mt-3 h-1 w-16 rounded-full bg-primary" />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((relatedProduct) => (
              <ProductCard
                key={relatedProduct.id}
                product={relatedProduct}
                locale={locale}
                massDiscountPct={massDiscountPct}
                currencyLabel={parameters.currency}
                outOfStockLabel={tStorefront('outOfStock')}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
