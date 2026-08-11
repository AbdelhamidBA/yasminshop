'use client';

import {useLocale, useTranslations} from 'next-intl';
import {usePathname, useRouter} from '@/i18n/navigation';

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('common');
  const other = locale === 'fr' ? 'ar' : 'fr';

  return (
    <button
      type="button"
      className="rounded-md border px-2 py-1 text-sm font-medium hover:bg-accent"
      onClick={() => router.replace(pathname, {locale: other})}
    >
      {t(other === 'ar' ? 'languageAr' : 'languageFr')}
    </button>
  );
}
