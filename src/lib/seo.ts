// Shared SEO constants and structured-data builders.
//
// The JSON-LD here is what turns a search result into a RICH result for a shop:
// Google reads Product/Offer to show the price and availability under the link,
// BreadcrumbList to show the category path instead of a bare URL, and
// Organization/WebSite to attach the brand to the domain. None of it is visible
// on the page — it exists purely to be machine-read, which is why it is built
// from the same values the page renders rather than hand-maintained beside them.

import type {Metadata} from 'next';

export const SITE_NAME = 'Yasmine Shop';

/**
 * For every surface that is signed-in, transactional or private. The root
 * layout opts the whole tree INTO indexing, so each of these has to opt back
 * out; robots.txt disallows the same paths, and the pages themselves are
 * already gated server-side. Three locks, because a page like an invoice or an
 * order confirmation carries a customer's name and address, and a single
 * indexed copy of one is not something a robots.txt edit can take back.
 */
export const NO_INDEX = {robots: {index: false, follow: false}} satisfies Metadata;

export const DEFAULT_DESCRIPTION =
  'Boutique en ligne tunisienne : produits importés et originaux, choisis avec soin. ' +
  'Paiement à la livraison, livraison partout en Tunisie.';

/** The share card. The hero is the only asset wide enough to read as one. */
export const OG_IMAGE = '/brand/hero.webp';

type JsonLd = Record<string, unknown>;

/** The shop itself — attaches the brand, logo and contact details to the domain. */
export function organizationJsonLd({
  origin,
  description,
  phone,
  email,
  sameAs
}: {
  origin: string;
  description: string;
  phone?: string;
  email?: string;
  sameAs?: string[];
}): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'OnlineStore',
    name: SITE_NAME,
    url: origin,
    logo: `${origin}/brand/yasmine-logo.png`,
    image: `${origin}${OG_IMAGE}`,
    description,
    areaServed: {'@type': 'Country', name: 'Tunisie'},
    // Only what the owner actually configured: an invented contact point is
    // worse than none, and these fields default to '' precisely so the shop can
    // leave them out.
    ...(phone || email
      ? {
          contactPoint: {
            '@type': 'ContactPoint',
            contactType: 'customer service',
            ...(phone ? {telephone: phone} : {}),
            ...(email ? {email} : {}),
            areaServed: 'TN',
            availableLanguage: ['fr']
          }
        }
      : {}),
    ...(sameAs && sameAs.length > 0 ? {sameAs} : {})
  };
}

/** Declares the site's search endpoint so Google can offer a sitelinks searchbox. */
export function webSiteJsonLd({origin, locale}: {origin: string; locale: string}): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: origin,
    inLanguage: locale,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${origin}/${locale}/products?q={search_term_string}`
      },
      'query-input': 'required name=search_term_string'
    }
  };
}

/**
 * One product. `price` is in MAJOR units (dinars) as a decimal string, which is
 * what schema.org expects — the rest of this codebase works in millimes, so the
 * conversion happens at exactly this boundary and nowhere else.
 */
export function productJsonLd({
  origin,
  url,
  name,
  description,
  images,
  reference,
  brand,
  priceMillimes,
  currency,
  inStock,
  categoryName
}: {
  origin: string;
  url: string;
  name: string;
  description: string;
  images: string[];
  reference: string;
  brand?: string | null;
  priceMillimes: number;
  currency: string;
  inStock: boolean;
  categoryName?: string;
}): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    ...(description ? {description} : {}),
    image: images.map((src) => (src.startsWith('http') ? src : `${origin}${src}`)),
    sku: reference,
    ...(brand ? {brand: {'@type': 'Brand', name: brand}} : {}),
    ...(categoryName ? {category: categoryName} : {}),
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: currency,
      price: (priceMillimes / 1000).toFixed(3),
      availability: inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: {'@type': 'Organization', name: SITE_NAME}
    }
  };
}

/** The path shown under a search result in place of a raw URL. */
export function breadcrumbJsonLd(items: {name: string; url: string}[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url
    }))
  };
}
