import {getTranslations, setRequestLocale} from 'next-intl/server';
import {ThemeToggle} from '@/components/theme-toggle';

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('heroTitle')}</h1>
          <p className="mt-2 text-muted-foreground">{t('heroSubtitle')}</p>
        </div>
        <ThemeToggle />
      </div>
    </main>
  );
}
