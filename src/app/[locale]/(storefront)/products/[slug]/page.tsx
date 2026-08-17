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
import {JsonLd} from '@/components/seo/json-ld';
import {Link} from '@/i18n/navigation';
import {cn} from '@/lib/utils';
import {
  effectivePriceMillimes,
  formatMillimes,
  unitPriceForQty,
  wholesaleApplies,
  wholesaleThreshold
} from '@/lib/money';
import {breadcrumbJsonLd, productJsonLd} from '@/lib/seo';
import {absoluteUrl, siteOrigin} from '@/lib/site-url';
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
  const path = `/${locale}/products/${slug}`;
  // The product's own photo as the share card, not the site-wide hero: a link
  // to a specific product should preview as THAT product.
  const image = product.images[0]?.url;
  return {
    title: name,
    description: description || undefined,
    alternates: {canonical: path},
    openGraph: {
      // 'website' rather than the (deprecated, unsupported by Next's typed
      // openGraph) 'product' type — the Product JSON-LD on the page is what
      // actually carries price and availability to crawlers.
      type: 'website',
      title: name,
      description: description || undefined,
      url: path,
      images: image ? [{url: image, alt: name}] : undefined
    },
    twitter: {
      card: 'summary_large_image',
      title: name,
      description: description || undefined,
      images: image ? [image] : undefined
    }
  };
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

  // The bulk offer, resolved through the same helpers the cart and the server
  // use. grosThreshold is what this product actually requires (its own
  // override, else the shop default); grosPrice is null whenever there is
  // nothing honest to advertise — no gros price set, a threshold that cannot
  // be reached, or a retail price that already beats it.
  const grosThreshold = wholesaleThreshold(
    product.wholesaleMinQty,
    parameters.wholesaleMinQty
  );
  const grosInput = {
    priceMillimes: product.priceMillimes,
    discountPct: product.discountPct,
    massDiscountPct,
    wholesalePriceMillimes: product.wholesalePriceMillimes,
    wholesaleMinQty: product.wholesaleMinQty,
    defaultMinQty: parameters.wholesaleMinQty,
    qty: Number.isFinite(grosThreshold) ? grosThreshold : 0
  };
  const grosPrice = wholesaleApplies(grosInput) ? unitPriceForQty(grosInput) : null;

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

  // Structured data. Built from the SAME values rendered below — the effective
  // price the shopper sees, the real stock, the actual breadcrumb — so a search
  // result can never advertise a price or an availability the page contradicts.
  const origin = siteOrigin();
  const productUrl = absoluteUrl(`/${locale}/products/${product.slug}`);
  const structuredData = [
    productJsonLd({
      origin,
      url: productUrl,
      name,
      description,
      images: product.images.map((image) => image.url),
      reference: product.reference,
      brand: product.brand,
      priceMillimes: effective,
      currency: parameters.currency,
      inStock: product.quantity > 0,
      categoryName
    }),
    breadcrumbJsonLd([
      {name: tBreadcrumb('home'), url: absoluteUrl(`/${locale}`)},
      {name: categoryName, url: absoluteUrl(`/${locale}${categoryHref}`)},
      ...(subCategoryName && subCategoryHref
        ? [{name: subCategoryName, url: absoluteUrl(`/${locale}${subCategoryHref}`)}]
        : []),
      {name, url: productUrl}
    ])
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-8">
      <JsonLd data={structuredData} />
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
          {/* The bulk offer, stated BEFORE the quantity stepper — a shopper
              cannot choose to buy five to earn a price they were never told
              about. Absent unless the gros price is real and actually cheaper
              than what they would pay today (wholesaleApplies at the
              threshold), so a mass discount that already beats it never
              produces a hollow promise. */}
          {grosPrice !== null && (
            <p className="mt-4 inline-flex flex-wrap items-baseline gap-x-2 rounded-lg bg-(--brand-cream) px-3 py-2 text-sm">
              <span className="font-semibold text-(--brand-brown)">
                {t('wholesaleFrom', {count: grosThreshold})}
              </span>
              <span className="font-bold tabular-nums">
                {formatMillimes(grosPrice)} {parameters.currency}
              </span>
              <span className="text-muted-foreground">{t('wholesalePerUnit')}</span>
            </p>
          )}
          <div className="mt-4">{stockLine}</div>
          <hr className="mt-6 border-dotted" />
          <div className="mt-6">
            <AddToCart
              productId={product.id}
              slug={product.slug}
              nameFr={product.nameFr}
              nameAr={product.nameAr}
              unitPriceMillimes={effective}
              wholesalePriceMillimes={product.wholesalePriceMillimes}
              wholesaleMinQty={product.wholesaleMinQty}
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
