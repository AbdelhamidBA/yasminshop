'use client';

import {useEffect, useId, useState} from 'react';
import {useTranslations} from 'next-intl';
import {Input} from '@/components/ui/input';
import {useRouter} from '@/i18n/navigation';
import {effectivePriceMillimes, formatMillimes} from '@/lib/money';
import {cn} from '@/lib/utils';

// Contract of GET /api/search-suggestions (Task 4).
type Suggestion = {
  id: string;
  slug: string;
  nameFr: string;
  nameAr: string;
  priceMillimes: number;
  discountPct: number;
  imageUrl: string | null;
};

type SearchBoxProps = {
  // Server-provided so the header stays a server component: SearchBox is the
  // client leaf and cannot read settings itself.
  locale: string;
  massDiscountPct: number | null;
  currencyLabel: string;
};

const DEBOUNCE_MS = 250;
// Mirror of the endpoint's threshold: shorter queries return no suggestions.
const MIN_QUERY_LENGTH = 2;

// Header search box with a typeahead suggestions listbox. Suggestions come
// from /api/search-suggestions (debounced 250ms); picking one records a
// fire-and-forget search hit and navigates to the product page; Enter with no
// active option runs a full catalog search (/products?q=…).
export function SearchBox({locale, massDiscountPct, currencyLabel}: SearchBoxProps) {
  const t = useTranslations();
  const router = useRouter();
  const id = useId();
  const listboxId = `${id}-listbox`;

  const [query, setQuery] = useState('');
  // null = nothing fetched for the current query yet (prevents the noResults
  // row from flashing before the first response arrives).
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_QUERY_LENGTH) {
      setSuggestions(null);
      setActiveIndex(-1);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/search-suggestions?q=${encodeURIComponent(q)}`,
          {signal: controller.signal}
        );
        if (!response.ok) return;
        const data: {suggestions?: Suggestion[]} = await response.json();
        setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
        setActiveIndex(-1);
        setOpen(true);
      } catch {
        // Aborted (query changed / unmount) or network failure: a typeahead
        // degrades silently rather than surfacing an error.
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Effective price: same expression as <Price/> (massDiscountPct overrides
  // the per-product pct) — client-side math on already-public numbers.
  const price = (s: Suggestion) =>
    `${formatMillimes(effectivePriceMillimes(s.priceMillimes, s.discountPct, massDiscountPct))} ${currencyLabel}`;

  function select(suggestion: Suggestion) {
    setOpen(false);
    // Fire-and-forget hit counter; keepalive lets the request outlive the
    // navigation that follows.
    fetch('/api/search-hits', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({productId: suggestion.id}),
      keepalive: true
    }).catch(() => {});
    router.push(`/products/${suggestion.slug}`);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!suggestions || suggestions.length === 0) return;
      event.preventDefault();
      setOpen(true);
      const count = suggestions.length;
      setActiveIndex((prev) =>
        prev === -1
          ? event.key === 'ArrowDown'
            ? 0
            : count - 1
          : (prev + (event.key === 'ArrowDown' ? 1 : -1) + count) % count
      );
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (open && suggestions && activeIndex >= 0 && activeIndex < suggestions.length) {
        select(suggestions[activeIndex]);
        return;
      }
      const q = query.trim();
      setOpen(false);
      router.push(q ? `/products?q=${encodeURIComponent(q)}` : '/products');
    }
  }

  const panelOpen = open && suggestions !== null && query.trim().length >= MIN_QUERY_LENGTH;

  return (
    <div className="relative w-full">
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => suggestions !== null && setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-label={t('common.search')}
        placeholder={t('common.search')}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={panelOpen}
        aria-controls={listboxId}
        aria-activedescendant={
          panelOpen && activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined
        }
        autoComplete="off"
        className="h-9"
      />
      {panelOpen && (
        <div
          // Keep clicks on the panel from blurring the input before the
          // option's onClick fires (blur closes the panel).
          onMouseDown={(event) => event.preventDefault()}
          className="absolute start-0 end-0 top-full z-50 mt-1 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
        >
          {suggestions.length > 0 ? (
            <ul role="listbox" id={listboxId} aria-label={t('common.search')}>
              {suggestions.map((suggestion, index) => (
                <li
                  key={suggestion.id}
                  id={`${id}-option-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  onClick={() => select(suggestion)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 px-3 py-2',
                    index === activeIndex && 'bg-accent'
                  )}
                >
                  {/* Same-origin /api/uploads image or the bundled placeholder. */}
                  <img
                    src={suggestion.imageUrl ?? '/placeholder-product.svg'}
                    alt=""
                    loading="lazy"
                    className="size-9 shrink-0 rounded-md border object-cover"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {locale === 'ar' ? suggestion.nameAr : suggestion.nameFr}
                  </span>
                  <span className="shrink-0 text-sm font-medium">{price(suggestion)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              {t('search.noResults')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
