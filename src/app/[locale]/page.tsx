import {getTranslations, setRequestLocale} from 'next-intl/server';

export default async function HomePage({
  params
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');

  return (
    <main className="mx-auto max-w-6xl p-8">
      <h1 className="text-3xl font-bold">{t('heroTitle')}</h1>
      <p className="mt-2 text-muted-foreground">{t('heroSubtitle')}</p>
    </main>
  );
}
