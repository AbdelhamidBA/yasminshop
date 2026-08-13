import {cache} from 'react';
import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious
} from '@/components/ui/carousel';
import {Eyebrow, Stamp} from '@/components/storefront/brand';
import {ProductCard} from '@/components/storefront/product-card';
import {Price} from '@/components/storefront/price';
import {Link} from '@/i18n/navigation';
import {cn} from '@/lib/utils';
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

  // Stock is stated from the real quantity against the owner's configured
  // lastChanceThreshold — never a manufactured urgency figure. Brown reads
  // "available", destructive reads "hurry / gone".
  const stockLine = (
    <span
      className={cn(
        'inline-flex items-center gap-2',
        product.quantity === 0 || product.quantity <= parameters.lastChanceThreshold
          ? 'text-destructive'
          : 'text-(--brand-brown)'
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      <Eyebrow tracked={!isAr}>
        {product.quantity === 0
          ? t('outOfStock')
          : product.quantity <= parameters.lastChanceThreshold
            ? t('lowStock', {count: product.quantity})
            : t('inStock')}
      </Eyebrow>
    </span>
  );

  const crumbSeparator = (
    <li aria-hidden="true" className="select-none text-muted-foreground/40">
      /
    </li>
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-8">
      {/* Breadcrumb: home / category / [subcategory] / product. Unboxed — it
          is navigation, not a panel competing with the product. */}
      <nav aria-label={tBreadcrumb('label')} className="text-xs text-muted-foreground">
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

      {/* Asymmetric 7/5: the gallery earns the width, the decision panel is
          narrow, decisive and follows the reader down the page. */}
      <div className="mt-6 grid gap-8 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-7">
          <Gallery
            images={product.images.map((image) => ({id: image.id, url: image.url}))}
            name={name}
          />
        </div>
        <div className="flex flex-col lg:col-span-5 lg:sticky lg:top-24 lg:self-start">
          {/* Brand above the name — the standard place a shopper looks for it,
              and simply absent when the product has none. */}
          {product.brand ? (
            <p className="mb-2 text-(--brand-brown)">
              <Eyebrow tracked={!isAr}>{product.brand}</Eyebrow>
            </p>
          ) : null}
          <h1 className="text-3xl leading-[1.1] font-extrabold text-balance sm:text-4xl">
            {name}
          </h1>
          <div className="mt-5 text-(--brand-brown)">
            <Price
              priceMillimes={product.priceMillimes}
              discountPct={product.discountPct}
              massDiscountPct={massDiscountPct}
              currencyLabel={parameters.currency}
              size="lg"
            />
          </div>
          <div className="mt-4">{stockLine}</div>
          <hr className="mt-6 border-dotted" />
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
          {/* The signature, placed where hesitation peaks: the promise that
              no money leaves anyone's hands until the parcel is in them. */}
          <div className="mt-7">
            <Stamp tracked={!isAr}>{t('codStamp')}</Stamp>
          </div>
          {/* Category/tag line — quiet, at the foot of the decision panel. */}
          <p className="mt-8 border-t pt-4 text-xs text-muted-foreground">
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

      {/* Description: reference's tab area, honestly a SINGLE active tab (no
          Reviews tab — reviews are not in the data model). Full description
          text lives here; the info column above shows a clamped teaser. */}
      <section className="mt-16" aria-labelledby="product-description-heading">
        <div className="flex items-center gap-4">
          <h2 id="product-description-heading" className="shrink-0">
            <Eyebrow tracked={!isAr}>{t('description')}</Eyebrow>
          </h2>
          <span aria-hidden="true" className="h-px flex-1 bg-border" />
        </div>
        <p className="mt-6 max-w-[68ch] leading-[1.75] whitespace-pre-line text-foreground/80">
          {description}
        </p>
      </section>

      {/* RELATED PRODUCTS — horizontal embla strip with partial-slide peek at
          every width (the karina browsing gesture; ≤4 real same-category
          products). Arrows come from the shared carousel: RTL-aware, disabled
          at the edges (and both disabled when everything already fits). */}
      {related.length > 0 && (
        <section className="mt-16">
          {/* Same heading treatment as Description: the page reads as one
              document rather than a stack of differently-styled blocks. */}
          <div className="flex items-center gap-4">
            <h2 className="shrink-0">
              <Eyebrow tracked={!isAr}>{t('related')}</Eyebrow>
            </h2>
            <span aria-hidden="true" className="h-px flex-1 bg-border" />
          </div>
          <Carousel
            aria-label={t('related')}
            opts={{align: 'start', slidesToScroll: 'auto'}}
            className="mt-7"
          >
            <CarouselContent viewportClassName="-my-2 py-2" className="-ms-4">
              {related.map((relatedProduct) => (
                <CarouselItem
                  key={relatedProduct.id}
                  className="basis-[78%] ps-4 sm:basis-[46%] md:basis-1/3 lg:basis-[29.5%]"
                >
                  <ProductCard
                    product={relatedProduct}
                    locale={locale}
                    massDiscountPct={massDiscountPct}
                    currencyLabel={parameters.currency}
                    outOfStockLabel={tStorefront('outOfStock')}
                  />
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="absolute -start-3 top-1/2 -translate-y-1/2" />
            <CarouselNext className="absolute -end-3 top-1/2 -translate-y-1/2" />
          </Carousel>
        </section>
      )}
    </div>
  );
}
