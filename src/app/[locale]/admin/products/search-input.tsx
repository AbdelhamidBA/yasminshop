'use client';

import {useTranslations} from 'next-intl';
import {useRouter} from '@/i18n/navigation';
import {Input} from '@/components/ui/input';

export function SearchInput({
  initialValue,
  includeArchived
}: {
  initialValue: string;
  includeArchived: boolean;
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
        if (includeArchived) params.set('archived', '1');
        router.replace(`/admin/products${params.size ? `?${params}` : ''}`);
      }}
      className="max-w-sm"
    >
      <Input name="q" defaultValue={initialValue} placeholder={t('search')} aria-label={t('search')} />
    </form>
  );
}
