import type {Metadata} from 'next';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {ArrowRight, HandCoins, Package, Truck} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';
import {Link} from '@/i18n/navigation';
import {cn} from '@/lib/utils';

export async function generateMetadata({
  params
}: {
  params: Promise<{locale: string}>;
}): Promise<Metadata> {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: 'about'});
  // The page's own lede is already the honest one-line summary of the shop —
  // reusing it keeps the search snippet and the page from drifting apart.
  const title = t('title');
  const description = t('lead');
  return {
    title,
    description,
    alternates: {canonical: `/${locale}/about`},
    openGraph: {title, description, url: `/${locale}/about`, type: 'website'}
  };
}

// À propos — honest short brand page: the YasmineShop story and the store's
// three real commitments (imported & local products, cash on delivery,
// nationwide delivery). No fabricated stats or testimonials.
export default async function AboutPage({
  params
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const t = await getTranslations('about');
  const isAr = locale === 'ar';

  const values: {icon: LucideIcon; title: string; body: string}[] = [
    {icon: Package, title: t('valueProductsTitle'), body: t('valueProductsBody')},
    {icon: HandCoins, title: t('valueCodTitle'), body: t('valueCodBody')},
    {icon: Truck, title: t('valueDeliveryTitle'), body: t('valueDeliveryBody')}
  ];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
      <div className="flex flex-col items-center text-center">
        {/* Decorative brand mark — the heading right below carries the name. */}
        <img src="/brand/yasmine-logo.webp" alt="" className="h-16 w-auto" />
        <h1 className="mt-5 font-serif text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {t('title')}
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">{t('lead')}</p>
      </div>

      <section className="mt-12">
        <h2
          className={cn(
            'text-center text-xl font-semibold sm:text-2xl',
            // Uppercase + tracking is FR-only: letter-spacing breaks the
            // joined Arabic script.
            !isAr && 'uppercase tracking-[0.14em]'
          )}
        >
          {t('storyTitle')}
        </h2>
        <div className="mx-auto mt-5 flex max-w-2xl flex-col gap-4 text-muted-foreground">
          <p>{t('story1')}</p>
          <p>{t('story2')}</p>
        </div>
      </section>

      <section className="mt-12">
        <h2
          className={cn(
            'text-center text-xl font-semibold sm:text-2xl',
            !isAr && 'uppercase tracking-[0.14em]'
          )}
        >
          {t('valuesTitle')}
        </h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-3">
          {values.map(({icon: Icon, title, body}) => (
            <li
              key={title}
              className="flex flex-col items-center gap-2 rounded-lg border bg-secondary/40 p-5 text-center"
            >
              <Icon className="size-6 text-primary" aria-hidden="true" />
              <h3 className="font-semibold">{title}</h3>
              <p className="text-sm text-muted-foreground">{body}</p>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-12 text-center">
        <Link
          href="/products"
          className={cn(
            'inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-7 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-(--primary-deep)',
            !isAr && 'uppercase tracking-[0.12em]'
          )}
        >
          {t('cta')}
          <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
