'use client';

import {useTranslations} from 'next-intl';
import {useRouter} from '@/i18n/navigation';
import {Input} from '@/components/ui/input';
import {AdminSearchField, adminSearchInputClass} from '@/components/admin/list-shell';

export function SearchInput({
  initialValue,
  keep
}: {
  initialValue: string;
  /** Active filter tab + rows-per-page, so searching stays on this tab. */
  keep: Record<string, string>;
}) {
  const t = useTranslations('admin.products');
  const router = useRouter();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const q = new FormData(event.currentTarget).get('q');
        const params = new URLSearchParams();
        if (q && String(q).trim()) params.set('q', String(q).trim());
        // `page` is deliberately absent: a new search restarts at page 1.
        for (const [key, value] of Object.entries(keep)) params.set(key, value);
        router.replace(`/admin/products${params.size ? `?${params}` : ''}`);
      }}
      className="w-full sm:max-w-xs"
    >
      <AdminSearchField>
        <Input
          name="q"
          defaultValue={initialValue}
          placeholder={t('search')}
          aria-label={t('search')}
          className={adminSearchInputClass}
        />
      </AdminSearchField>
    </form>
  );
}
