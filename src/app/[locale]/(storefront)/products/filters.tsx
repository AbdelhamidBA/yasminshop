'use client';

import {useId} from 'react';
import {useSearchParams} from 'next/navigation';
import {useLocale, useTranslations} from 'next-intl';
import {Eyebrow} from '@/components/storefront/brand';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Switch} from '@/components/ui/switch';
import {useRouter} from '@/i18n/navigation';
import {cn} from '@/lib/utils';
// Type-only import: erased at compile time, so the server-only module is
// never bundled into this client component.
import type {StorefrontCategoryNode} from '@/server/storefront';

// The rail is a printed INDEX, not a control panel: utility-face group
// headings, dotted receipt rules between groups, and a single gold rule
// marking the entry the reader is standing on (the only gold in the panel).
// Sort lives above the grid instead — it orders results, it does not filter
// them — and "clear" lives in the active-filter chip row above.
//
// Rendered twice by the catalog page (lg sidebar + mobile <details>), so all
// element ids come from useId() to stay unique per instance.
export function Filters({categories}: {categories: StorefrontCategoryNode[]}) {
  const t = useTranslations('catalog');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = useId();

  const isAr = locale === 'ar';
  const name = (node: {nameFr: string; nameAr: string}) =>
    isAr ? node.nameAr : node.nameFr;

  const cat = searchParams.get('cat') ?? '';
  const sub = searchParams.get('sub') ?? '';
  const min = searchParams.get('min') ?? '';
  const max = searchParams.get('max') ?? '';
  const inStock = searchParams.get('stock') === '1';

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

  const groupHeading = (label: string) => (
    <h3 className="mb-3 text-muted-foreground">
      <Eyebrow tracked={!isAr}>{label}</Eyebrow>
    </h3>
  );

  const categoryEntry = (
    label: string,
    active: boolean,
    onClick: () => void,
    indent = false
  ) => (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'group/entry relative flex w-full items-center rounded-md py-1.5 pe-2 text-start text-sm transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        indent ? 'ps-7 text-[13px]' : 'ps-4',
        active ? 'font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {/* The rule in the margin: gold where you are, a hairline under the
          pointer, nothing otherwise. */}
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-y-1 start-0 w-[3px] rounded-full transition-colors',
          active ? 'bg-primary' : 'bg-transparent group-hover/entry:bg-border'
        )}
      />
      {label}
    </button>
  );

  const rule = <hr className="border-t border-dotted" />;

  return (
    <div className="flex flex-col gap-5">
      <section>
        {groupHeading(t('categories'))}
        <div className="flex flex-col gap-px">
          {categoryEntry(t('allCategories'), cat === '' && sub === '', () =>
            update({cat: null, sub: null})
          )}
          {categories.map((root) => (
            <div key={root.id} className="flex flex-col gap-px">
              {categoryEntry(name(root), cat === root.slug && sub === '', () =>
                update({cat: root.slug, sub: null})
              )}
              {root.children.map((child) => (
                <div key={child.id}>
                  {categoryEntry(
                    name(child),
                    sub === child.slug,
                    () => update({cat: root.slug, sub: child.slug}),
                    true
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {rule}

      <section>
        {groupHeading(t('price'))}
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
          className="flex flex-col gap-3"
        >
          <div className="flex items-end gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Label htmlFor={`${id}-min`} className="text-muted-foreground">
                <Eyebrow tracked={!isAr}>{t('min')}</Eyebrow>
              </Label>
              <Input
                key={`min:${min}`}
                id={`${id}-min`}
                name="min"
                dir="ltr"
                inputMode="decimal"
                defaultValue={min}
                className="h-9 tabular-nums"
              />
            </div>
            <span aria-hidden="true" className="pb-2.5 text-muted-foreground/60">
              –
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Label htmlFor={`${id}-max`} className="text-muted-foreground">
                <Eyebrow tracked={!isAr}>{t('max')}</Eyebrow>
              </Label>
              <Input
                key={`max:${max}`}
                id={`${id}-max`}
                name="max"
                dir="ltr"
                inputMode="decimal"
                defaultValue={max}
                className="h-9 tabular-nums"
              />
            </div>
          </div>
          <button
            type="submit"
            className={cn(
              'h-9 w-full rounded-lg border text-xs font-semibold transition-colors',
              'hover:border-(--primary-deep) hover:text-(--brand-brown)',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              !isAr && 'uppercase tracking-[0.14em]'
            )}
          >
            {t('apply')}
          </button>
        </form>
      </section>

      {rule}

      <section className="flex items-center justify-between gap-3">
        <Label htmlFor={`${id}-stock`} className="min-w-0 text-muted-foreground">
          <Eyebrow tracked={!isAr}>{t('inStockOnly')}</Eyebrow>
        </Label>
        <Switch
          id={`${id}-stock`}
          checked={inStock}
          onCheckedChange={(checked) => update({stock: checked ? '1' : null})}
        />
      </section>
    </div>
  );
}
