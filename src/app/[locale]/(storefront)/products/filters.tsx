'use client';

import {useId} from 'react';
import {useSearchParams} from 'next/navigation';
import {useLocale, useTranslations} from 'next-intl';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {Switch} from '@/components/ui/switch';
import {Link, useRouter} from '@/i18n/navigation';
import {cn} from '@/lib/utils';
// Type-only import: erased at compile time, so the server-only module is
// never bundled into this client component.
import type {StorefrontCategoryNode} from '@/server/storefront';

const SORT_VALUES = ['new', 'priceAsc', 'priceDesc'] as const;

// Rendered twice by the catalog page (lg sidebar + mobile <details>), so all
// element ids come from useId() to stay unique per instance.
export function Filters({categories}: {categories: StorefrontCategoryNode[]}) {
  const t = useTranslations('catalog');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = useId();

  const name = (node: {nameFr: string; nameAr: string}) =>
    locale === 'ar' ? node.nameAr : node.nameFr;

  const cat = searchParams.get('cat') ?? '';
  const sub = searchParams.get('sub') ?? '';
  const min = searchParams.get('min') ?? '';
  const max = searchParams.get('max') ?? '';
  const inStock = searchParams.get('stock') === '1';
  const sortParam = searchParams.get('sort');
  const sort = (SORT_VALUES as readonly string[]).includes(sortParam ?? '')
    ? (sortParam as (typeof SORT_VALUES)[number])
    : 'new';

  // Single URL-writing path: merge overrides into the current query, drop
  // empty values, and reset pagination on ANY filter change.
  function update(overrides: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(overrides)) {
      if (value === null || value === '') params.delete(key);
      else params.set(key, value);
    }
    params.delete('page');
    router.replace(`/products${params.size ? `?${params}` : ''}`);
  }

  // "Clear" removes the filters (q included); sort is an ordering, not a
  // filter, so it survives.
  const hasActiveFilter = ['q', 'cat', 'sub', 'min', 'max', 'stock'].some(
    (key) => searchParams.get(key) !== null
  );
  const clearQs = sortParam ? `?${new URLSearchParams({sort: sortParam})}` : '';

  const categoryButton = (
    label: string,
    active: boolean,
    onClick: () => void,
    indent = false
  ) => (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'block w-full rounded-md px-2 py-1 text-start text-sm transition-colors hover:bg-accent',
        indent && 'ps-5',
        active ? 'bg-accent font-medium' : 'text-muted-foreground'
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h3 className="mb-2 text-sm font-semibold">{t('categories')}</h3>
        <div className="flex flex-col gap-0.5">
          {categoryButton(t('allCategories'), cat === '' && sub === '', () =>
            update({cat: null, sub: null})
          )}
          {categories.map((root) => (
            <div key={root.id} className="flex flex-col gap-0.5">
              {categoryButton(name(root), cat === root.slug && sub === '', () =>
                update({cat: root.slug, sub: null})
              )}
              {root.children.map((child) =>
                <div key={child.id}>
                  {categoryButton(name(child), sub === child.slug, () =>
                    update({cat: root.slug, sub: child.slug}), true
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold">{t('price')}</h3>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            // Raw dinars strings go into the URL; the server page parses them
            // with parseDinarsToMillimes and ignores invalid values.
            update({
              min: String(data.get('min') ?? '').trim(),
              max: String(data.get('max') ?? '').trim()
            });
          }}
          className="flex items-end gap-2"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <Label htmlFor={`${id}-min`} className="text-xs text-muted-foreground">
              {t('min')}
            </Label>
            <Input
              key={`min:${min}`}
              id={`${id}-min`}
              name="min"
              dir="ltr"
              inputMode="decimal"
              defaultValue={min}
              className="h-8"
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <Label htmlFor={`${id}-max`} className="text-xs text-muted-foreground">
              {t('max')}
            </Label>
            <Input
              key={`max:${max}`}
              id={`${id}-max`}
              name="max"
              dir="ltr"
              inputMode="decimal"
              defaultValue={max}
              className="h-8"
            />
          </div>
          <button
            type="submit"
            className="h-8 shrink-0 rounded-md border px-3 text-sm font-medium transition-colors hover:bg-accent"
          >
            {t('apply')}
          </button>
        </form>
      </section>

      <section className="flex items-center gap-3">
        <Switch
          id={`${id}-stock`}
          checked={inStock}
          onCheckedChange={(checked) => update({stock: checked ? '1' : null})}
        />
        <Label htmlFor={`${id}-stock`}>{t('inStockOnly')}</Label>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold">{t('sort')}</h3>
        <Select
          value={sort}
          onValueChange={(value) =>
            update({sort: value === null || value === 'new' ? null : String(value)})
          }
          items={SORT_VALUES.map((value) => ({
            value,
            label: t(
              value === 'new' ? 'sortNew' : value === 'priceAsc' ? 'sortPriceAsc' : 'sortPriceDesc'
            )
          }))}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_VALUES.map((value) => (
              <SelectItem key={value} value={value}>
                {t(
                  value === 'new'
                    ? 'sortNew'
                    : value === 'priceAsc'
                      ? 'sortPriceAsc'
                      : 'sortPriceDesc'
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      {hasActiveFilter && (
        <Link
          href={`/products${clearQs}`}
          className="text-sm underline underline-offset-4 hover:text-foreground"
        >
          {t('clear')}
        </Link>
      )}
    </div>
  );
}
