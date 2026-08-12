import {getLocale, getTranslations} from 'next-intl/server';
import {Eyebrow} from '@/components/storefront/brand';
import {Link} from '@/i18n/navigation';

// The footer used to repeat the four service promises already made by the
// announcement bar and the order-lifecycle band — three statements of the
// same thing on one page. A footer's job is to help someone go somewhere, so
// it now carries the brand line and real navigation instead. Every link here
// points at a page that exists.
export async function SiteFooter() {
  const [t, locale] = await Promise.all([getTranslations(), getLocale()]);
  const tracked = locale !== 'ar';

  const columns = [
    {
      heading: t('nav.shop'),
      links: [
        {href: '/products', label: t('nav.shop')},
        {href: '/products?sort=new', label: t('nav.newArrivals')},
        {href: '/#meilleures-ventes', label: t('nav.bestSellers')}
      ]
    },
    {
      heading: t('common.siteName'),
      links: [
        {href: '/about', label: t('nav.about')},
        {href: '/contact', label: t('nav.contact')}
      ]
    },
    {
      heading: t('nav.account'),
      links: [
        {href: '/account/orders', label: t('myOrders.title')},
        {href: '/login', label: t('common.login')}
      ]
    }
  ];

  return (
    <footer className="mt-16 border-t bg-secondary/40">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/brand/yasmine-logo.webp" alt="" className="h-9 w-auto" />
            <span className="flex flex-col items-center">
              <span className="font-(family-name:--font-betterlett) text-xl leading-none">
                Yasmine
              </span>
              <span className="mt-1 flex items-center gap-1.5 text-[10px] leading-none font-semibold tracking-[0.28em] text-foreground/70 uppercase">
                <span aria-hidden="true" className="h-px w-4 bg-foreground/40" />
                Shop
                <span aria-hidden="true" className="h-px w-4 bg-foreground/40" />
              </span>
            </span>
          </Link>
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-muted-foreground">
            {t('about.lead')}
          </p>
        </div>
        {columns.map((column) => (
          <nav key={column.heading} aria-label={column.heading}>
            <h2 className="text-muted-foreground">
              <Eyebrow tracked={tracked}>{column.heading}</Eyebrow>
            </h2>
            <ul className="mt-5 flex flex-col gap-3">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-foreground/80 transition-colors hover:text-primary"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-6 text-center text-sm text-muted-foreground">
          {t('common.siteName')} — {t('footer.copyright')}
        </div>
      </div>
    </footer>
  );
}
