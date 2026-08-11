'use client';

import {useLocale, useTranslations} from 'next-intl';
import {useSearchParams} from 'next/navigation';
import {usePathname, useRouter} from '@/i18n/navigation';

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations('common');
  const other = locale === 'fr' ? 'ar' : 'fr';

  return (
    <button
      type="button"
      className="rounded-md border px-2 py-1 text-sm font-medium hover:bg-accent"
      onClick={() => {
        // Preserve the query string (filters, search, pagination) across
        // locale switches. String hrefs are valid without a pathnames config.
        const qs = searchParams.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, {locale: other});
      }}
    >
      {t(other === 'ar' ? 'languageAr' : 'languageFr')}
    </button>
  );
}
