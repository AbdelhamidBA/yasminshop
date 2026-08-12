import {getTranslations} from 'next-intl/server';
import {TrustBadges} from '@/components/storefront/trust-badges';

export async function SiteFooter() {
  const t = await getTranslations();

  return (
    <footer className="mt-8 border-t">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <TrustBadges variant="footer" />
      </div>
      <div className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-6 text-center text-sm text-muted-foreground">
          {t('common.siteName')} — {t('footer.copyright')}
        </div>
      </div>
    </footer>
  );
}
