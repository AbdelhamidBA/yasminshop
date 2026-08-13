'use client';

import {useState} from 'react';
import {Menu, X} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {AdminNav} from '@/components/admin/admin-nav';
import {Button} from '@/components/ui/button';
import {Sheet, SheetClose, SheetContent} from '@/components/ui/sheet';
import {Link} from '@/i18n/navigation';

// Phone/tablet navigation: a burger in the admin header that opens the FULL
// nav as a drawer from the inline-start edge. Below `lg` the desktop rail is
// not rendered at all, so this is the only way to the other admin screens —
// and, unlike the mini icon rail it replaces, every entry is labelled.
//
// `lg:hidden` on the trigger, not a media hook: the drawer is inert (and the
// button out of the accessibility tree) on desktop, with no hydration
// mismatch and no layout flash.
//
// The sheet primitive brings the focus trap, the Escape key and the backdrop
// dismissal; selection closes it here because client-side navigation keeps the
// admin layout — and this component's state — mounted.
export function AdminMobileNav({isAdmin}: {isAdmin: boolean}) {
  const t = useTranslations('admin');
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        aria-label={t('openMenu')}
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors outline-none hover:bg-(--admin-neutral-soft) hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 lg:hidden"
      >
        <Menu className="size-5" />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        {/* theme-minimal: the sheet portals to <body>, outside the admin
            subtree, so it carries the dashboard token scope itself — same
            precedent as the admin selects and dialogs. */}
        <SheetContent
          side="start"
          aria-label={t('menu')}
          className="theme-minimal max-w-[86%] bg-card sm:max-w-xs"
        >
          <div className="flex h-16 shrink-0 items-center justify-between gap-3 px-5">
            <Link
              href="/admin"
              aria-label={t('brand')}
              onClick={close}
              className="flex min-w-0 items-center gap-3 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <img
                src="/brand/yasmine-logo.webp"
                alt=""
                className="size-9 shrink-0 object-contain"
              />
              <span className="flex min-w-0 flex-col">
                <span className="font-(family-name:--font-betterlett) truncate text-xl leading-none">
                  Yasmine
                </span>
                <span className="mt-1 flex items-center gap-1.5 text-[10px] leading-none font-semibold tracking-[0.28em] text-foreground/70 uppercase">
                  <span aria-hidden="true" className="h-px w-3 bg-foreground/40" />
                  Shop
                  <span aria-hidden="true" className="h-px w-3 bg-foreground/40" />
                </span>
              </span>
            </Link>
            <SheetClose
              render={<Button variant="ghost" size="icon-sm" aria-label={t('closeMenu')} />}
            >
              <X />
            </SheetClose>
          </div>
          {/* Its own scrollport: a nav list longer than a phone screen stays
              reachable without scrolling the page behind the drawer. */}
          <nav aria-label={t('navLabel')} className="min-h-0 flex-1 overflow-y-auto pb-6">
            <AdminNav isAdmin={isAdmin} onNavigate={close} />
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
