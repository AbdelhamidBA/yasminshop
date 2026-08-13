import {Link} from '@/i18n/navigation';
import {cn} from '@/lib/utils';
import type {AdminTone} from '@/components/admin/ui';

// Counted filter tabs above an admin table: "Actifs 10 · En rupture 2 · …".
//
// They replace the stat cards that used to sit above the products list: the
// same figures, but each one now *does* something — it filters the list —
// instead of being a number the operator then had to go and filter for by
// hand. One row of tabs also costs a fraction of the vertical space four
// cards did, which matters on a phone.
//
// Rendered as real links, so a filtered list is bookmarkable and shareable and
// works before hydration. Counts are computed server-side against the same
// where-clauses the list uses, so a tab can never disagree with its rows.

export type FilterTab = {
  key: string;
  label: string;
  /** Real count for this filter. */
  count: number;
  href: string;
  active: boolean;
  /** Tints the count chip on the active tab; defaults to neutral. */
  tone?: AdminTone;
};

const TONE_ACTIVE: Record<AdminTone, string> = {
  primary: 'bg-(--admin-primary-soft) text-(--admin-primary-dark)',
  info: 'bg-(--admin-info-soft) text-(--admin-info)',
  success: 'bg-(--admin-success-soft) text-(--admin-success)',
  warning: 'bg-(--admin-warning-soft) text-(--admin-warning)',
  error: 'bg-(--admin-error-soft) text-(--admin-error)',
  neutral: 'bg-(--admin-neutral-soft) text-muted-foreground'
};

export function FilterTabs({tabs, label}: {tabs: FilterTab[]; label: string}) {
  if (tabs.length === 0) return null;
  return (
    // Scrolls horizontally on a phone rather than wrapping into a tall block
    // or pushing the page sideways.
    <nav aria-label={label} className="flex items-center gap-1 overflow-x-auto px-2">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.active ? 'page' : undefined}
          className={cn(
            'inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm whitespace-nowrap transition-colors',
            'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
            tab.active
              ? 'border-primary font-semibold text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          {tab.label}
          <span
            className={cn(
              'inline-flex h-5 min-w-5 items-center justify-center rounded-md px-1.5 text-xs font-bold tabular-nums',
              tab.active ? TONE_ACTIVE[tab.tone ?? 'primary'] : TONE_ACTIVE.neutral
            )}
          >
            {tab.count}
          </span>
        </Link>
      ))}
    </nav>
  );
}
