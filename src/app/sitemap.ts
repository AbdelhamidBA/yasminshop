import type {MetadataRoute} from 'next';
import {routing} from '@/i18n/routing';
import {prisma} from '@/lib/db';
import {absoluteUrl} from '@/lib/site-url';
import {VISIBLE} from '@/server/storefront';

// Served at /sitemap.xml.
//
// Built from the database rather than hand-listed, so a product added in the
// admin is discoverable without anyone remembering to edit a file. It reuses
// the storefront's own VISIBLE filter, which means an archived product — or one
// whose CATEGORY was archived — leaves the sitemap the moment it leaves the
// shop. Submitting URLs that 404 is worse than not submitting them.
//
// Priorities are relative, not absolute: the home page and the catalogue are
// the entry points, individual products sit below them, and the static pages
// below that.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const locale = routing.defaultLocale;

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where: VISIBLE,
      orderBy: {createdAt: 'desc'},
      select: {slug: true, createdAt: true, images: {take: 1, select: {url: true}}}
    }),
    prisma.category.findMany({
      where: {archivedAt: null},
      orderBy: {slug: 'asc'},
      select: {slug: true}
    })
  ]);

  const entry = (
    path: string,
    priority: number,
    changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'],
    lastModified?: Date
  ): MetadataRoute.Sitemap[number] => ({
    url: absoluteUrl(`/${locale}${path}`),
    lastModified: lastModified ?? new Date(),
    changeFrequency,
    priority
  });

  return [
    entry('', 1, 'daily'),
    entry('/products', 0.9, 'daily'),
    entry('/about', 0.4, 'yearly'),
    entry('/contact', 0.4, 'yearly'),
    // A category is a filter on the catalogue, not a route of its own, so it is
    // listed as the query it actually resolves to.
    ...categories.map((category) =>
      entry(`/products?category=${encodeURIComponent(category.slug)}`, 0.6, 'weekly')
    ),
    ...products.map((product) => ({
      ...entry(`/products/${product.slug}`, 0.8, 'weekly', product.createdAt),
      // Google Images reads these; without them the shop's own photography is
      // only discoverable by crawling each page.
      images: product.images[0] ? [absoluteUrl(product.images[0].url)] : undefined
    }))
  ];
}
