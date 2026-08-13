'use client';

import {useTranslations} from 'next-intl';
import {Input} from '@/components/ui/input';
import {AdminSearchField, adminSearchInputClass} from '@/components/admin/list-shell';
import {useRouter} from '@/i18n/navigation';

// Same submit-to-URL idiom as the admin orders search; preserves the archived
// toggle, resets pagination.
export function ClientsSearch({
  initialValue,
  includeArchived
}: {
  initialValue: string;
  includeArchived: boolean;
}) {
  const t = useTranslations('adminClients');
  const router = useRouter();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const q = new FormData(event.currentTarget).get('q');
        const params = new URLSearchParams();
        if (q && String(q).trim()) params.set('q', String(q).trim());
        if (includeArchived) params.set('archived', '1');
        router.replace(`/admin/clients${params.size ? `?${params}` : ''}`);
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
