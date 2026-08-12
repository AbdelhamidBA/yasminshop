'use client';

import {useState} from 'react';
import {Popover} from '@base-ui/react/popover';
import {Search} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {SearchBox} from '@/components/storefront/search-box';

type SearchButtonProps = {
  // Server-provided so the header stays a server component: SearchBox is the
  // client leaf and cannot read settings itself.
  locale: string;
  massDiscountPct: number | null;
  currencyLabel: string;
};

// Mockup icon group entry: an icon-only magnifier button opening a Base UI
// popover that hosts the existing SearchBox (typeahead suggestions and all).
// Controlled open state so a suggestion pick / full-search Enter can close
// the popover — the header survives the client navigation, so an uncontrolled
// popup would linger over the next page.
export function SearchButton({locale, massDiscountPct, currencyLabel}: SearchButtonProps) {
  const t = useTranslations('common');
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        render={
          <button
            type="button"
            aria-label={t('search')}
            className="flex size-9 items-center justify-center rounded-md border hover:bg-accent data-popup-open:bg-accent"
          />
        }
      >
        <Search className="size-4" aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={8} className="isolate z-50 outline-none">
          {/* theme-yasmine: the popup portals to <body>, outside the
              storefront layout wrapper, so it carries the token scope. */}
          <Popover.Popup className="theme-yasmine w-80 max-w-[calc(100vw-2rem)] origin-(--transform-origin) rounded-xl bg-popover p-2 text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <SearchBox
              locale={locale}
              massDiscountPct={massDiscountPct}
              currencyLabel={currencyLabel}
              autoFocus
              onNavigate={() => setOpen(false)}
            />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
