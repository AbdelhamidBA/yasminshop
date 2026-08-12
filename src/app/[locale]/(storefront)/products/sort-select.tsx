'use client';

import {useSearchParams} from 'next/navigation';
import {useLocale, useTranslations} from 'next-intl';
import {Eyebrow} from '@/components/storefront/brand';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {useRouter} from '@/i18n/navigation';

const SORT_VALUES = ['new', 'priceAsc', 'priceDesc'] as const;

// Sort is an ORDERING, not a filter, so it sits above the results instead of
// inside the filter rail — and unlike the rail it is rendered once, always
// visible, at every width. Same URL contract as Filters: 'new' is the default
// and drops the param, and any change resets pagination.
export function SortSelect() {
  const t = useTranslations('catalog');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();

  const isAr = locale === 'ar';
  const sortParam = searchParams.get('sort');
  const sort = (SORT_VALUES as readonly string[]).includes(sortParam ?? '')
    ? (sortParam as (typeof SORT_VALUES)[number])
    : 'new';

  const label = (value: (typeof SORT_VALUES)[number]) =>
    t(value === 'new' ? 'sortNew' : value === 'priceAsc' ? 'sortPriceAsc' : 'sortPriceDesc');

  function change(value: unknown) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === null || value === 'new') params.delete('sort');
    else params.set('sort', String(value));
    params.delete('page');
    router.replace(`/products${params.size ? `?${params}` : ''}`);
  }

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="shrink-0 text-muted-foreground">
        <Eyebrow tracked={!isAr}>{t('sort')}</Eyebrow>
      </span>
      <Select
        value={sort}
        onValueChange={change}
        items={SORT_VALUES.map((value) => ({value, label: label(value)}))}
      >
        <SelectTrigger
          aria-label={t('sort')}
          className="h-9 w-auto min-w-0 rounded-lg bg-card ps-3 text-sm font-medium"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORT_VALUES.map((value) => (
            <SelectItem key={value} value={value}>
              {label(value)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
