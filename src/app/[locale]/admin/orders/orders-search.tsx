'use client';

import {useTranslations} from 'next-intl';
import {Input} from '@/components/ui/input';
import {useRouter} from '@/i18n/navigation';
import type {OrderStatus} from '@/lib/orders';

// Same submit-to-URL idiom as the admin products SearchInput; preserves the
// active status tab and archived toggle, resets pagination.
export function OrdersSearch({
  initialValue,
  status,
  includeArchived
}: {
  initialValue: string;
  status: OrderStatus | undefined;
  includeArchived: boolean;
}) {
  const t = useTranslations('adminOrders');
  const router = useRouter();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const q = new FormData(event.currentTarget).get('q');
        const params = new URLSearchParams();
        if (q && String(q).trim()) params.set('q', String(q).trim());
        if (status) params.set('status', status);
        if (includeArchived) params.set('archived', '1');
        router.replace(`/admin/orders${params.size ? `?${params}` : ''}`);
      }}
      className="max-w-sm"
    >
      <Input name="q" defaultValue={initialValue} placeholder={t('search')} aria-label={t('search')} />
    </form>
  );
}
