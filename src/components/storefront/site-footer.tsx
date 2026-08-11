import {getTranslations} from 'next-intl/server';

export async function SiteFooter() {
  const t = await getTranslations();

  return (
    <footer className="border-t py-8">
      <div className="mx-auto max-w-6xl px-4 text-center text-sm text-muted-foreground">
        {t('common.siteName')} — {t('footer.copyright')}
      </div>
    </footer>
  );
}
