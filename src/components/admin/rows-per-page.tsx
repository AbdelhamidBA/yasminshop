'use client';

import {useRouter, useSearchParams} from 'next/navigation';
import {usePathname} from '@/i18n/navigation';
import {useTranslations} from 'next-intl';
import {PAGE_SIZES} from '@/lib/pagination';
import {cn} from '@/lib/utils';

// Rows-per-page control for the admin lists. A plain <select>: it is one tap
// on mobile, needs no portal (so no theme-scope trap), and keeps the value in
// the URL like every other list parameter — so a chosen size survives a
// refresh and can be shared in a link.
//
// Changing the size always returns to page 1: staying on page 7 while moving
// from 10 to 100 rows would land the operator past the end of the list.
export function RowsPerPage({value, className}: {value: number; className?: string}) {
  const t = useTranslations('admin.list');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onChange(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('page');
    params.set('per', next);
    router.push(`${pathname}${params.size ? `?${params}` : ''}`);
  }

  return (
    <label className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}>
      {t('rowsPerPage')}
      <select
        value={String(value)}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 rounded-lg border bg-card px-2 text-sm font-medium text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {PAGE_SIZES.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>
    </label>
  );
}
