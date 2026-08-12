'use client';

import {useEffect, useId, useRef, useState} from 'react';
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
  // Focus the input on mount — the header search popover opens straight into
  // typing (the popover's default initial focus agrees; this pins it).
  autoFocus?: boolean;
  // Fired right before any navigation this box triggers (suggestion pick or
  // full-search Enter) so a hosting popover can close itself — the header
  // survives client navigation, so it would linger open otherwise.
  onNavigate?: () => void;
};

const DEBOUNCE_MS = 250;
// Mirror of the endpoint's threshold: shorter queries return no suggestions.
const MIN_QUERY_LENGTH = 2;

// Header search box with a typeahead suggestions listbox. Suggestions come
// from /api/search-suggestions (debounced 250ms); picking one records a
// fire-and-forget search hit and navigates to the product page; Enter with no
// active option runs a full catalog search (/products?q=…).
export function SearchBox({
  locale,
  massDiscountPct,
  currencyLabel,
  autoFocus,
  onNavigate
}: SearchBoxProps) {
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
  // Focus tracked in a ref so the async response handler below can read the
  // CURRENT focus state: a late response arriving after blur must not reopen
  // the panel (the header survives client navigation, so a resurrected panel
  // would linger over the next page with no outside-click dismissal).
  const focusedRef = useRef(false);
  // Explicit dismissals (Escape, Enter in either mode, option click) must
  // also outlive the render cycle: the input can stay focused after any of
  // them, so a late response gated on focus alone would still reopen the
  // panel against the user's intent. Lifted on re-engagement: a keystroke,
  // (re)focus, or arrow keys.
  const dismissedRef = useRef(false);

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
        if (!response.ok) {
          // Don't leave a previous query's suggestions on screen.
          setSuggestions(null);
          setActiveIndex(-1);
          return;
        }
        const data: {suggestions?: Suggestion[]} = await response.json();
        setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
        setActiveIndex(-1);
        // Only (re)open while the input still has focus AND the user has not
        // explicitly dismissed the panel since last engaging with it — see
        // focusedRef / dismissedRef above.
        if (focusedRef.current && !dismissedRef.current) setOpen(true);
      } catch {
        // Abort (query changed / unmount) is expected — leave state alone.
        // Any other failure (network, bad JSON) clears stale suggestions; a
        // typeahead degrades silently rather than surfacing an error.
        if (!controller.signal.aborted) {
          setSuggestions(null);
          setActiveIndex(-1);
        }
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
    // Covers Enter-select AND option click: the mousedown preventDefault
    // keeps the input focused through the navigation, so a late response
    // must see this as a dismissal.
    dismissedRef.current = true;
    setOpen(false);
    // Fire-and-forget hit counter; keepalive lets the request outlive the
    // navigation that follows.
    fetch('/api/search-hits', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({productId: suggestion.id}),
      keepalive: true
    }).catch(() => {});
    onNavigate?.();
    router.push(`/products/${suggestion.slug}`);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      // Escape does not blur a plain input: without this flag a response
      // already in flight would reopen the panel the user just closed.
      dismissedRef.current = true;
      setOpen(false);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      // Arrows are re-engagement even before anything is fetched: lift a
      // prior dismissal BEFORE the empty guard, so Escape+ArrowDown racing
      // ahead of the first response doesn't leave the panel suppressed.
      dismissedRef.current = false;
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
      // Full-search Enter is a dismissal too: the header (and this input's
      // focus) survives the client navigation to /products.
      dismissedRef.current = true;
      setOpen(false);
      onNavigate?.();
      router.push(q ? `/products?q=${encodeURIComponent(q)}` : '/products');
    }
  }

  const panelOpen = open && suggestions !== null && query.trim().length >= MIN_QUERY_LENGTH;

  return (
    <div className="relative w-full">
      <Input
        value={query}
        onChange={(event) => {
          // A new keystroke is fresh engagement: lift any prior dismissal so
          // the upcoming query's response may open the panel again.
          dismissedRef.current = false;
          setQuery(event.target.value);
        }}
        onKeyDown={onKeyDown}
        onFocus={() => {
          focusedRef.current = true;
          // Refocusing is fresh engagement; it deliberately reopens a cached
          // panel below, so the dismissal flag must not outlive it.
          dismissedRef.current = false;
          if (suggestions !== null) setOpen(true);
        }}
        onBlur={() => {
          focusedRef.current = false;
          setOpen(false);
        }}
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
        autoFocus={autoFocus}
        className="h-9"
      />
      {panelOpen && (
        <div
          // Keep clicks on the panel from blurring the input before the
          // option's onClick fires (blur closes the panel).
          onMouseDown={(event) => event.preventDefault()}
          className="absolute start-0 end-0 top-full z-50 mt-1 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
        >
          <ul role="listbox" id={listboxId} aria-label={t('common.search')}>
            {suggestions.length > 0 ? (
              suggestions.map((suggestion, index) => (
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
              ))
            ) : (
              // Non-selectable empty row INSIDE the listbox, so aria-controls
              // always references a rendered element while the panel is open.
              <li
                id={`${id}-option-empty`}
                role="option"
                aria-disabled="true"
                aria-selected={false}
                className="px-3 py-2 text-sm text-muted-foreground"
              >
                {t('search.noResults')}
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
