import type {ReactNode} from 'react';
import {Link} from '@/i18n/navigation';
import {cn} from '@/lib/utils';

// YasmineShop design primitives.
//
// The storefront's visual language comes from the physical artifacts of
// cash-on-delivery commerce — the delivery note, the dotted receipt line and
// the shop's stamp (cachet) — because trust, not luxury, is what this store
// has to earn: customers pay a stranger at their door for goods they have
// only seen on a screen.
//
// Palette and typefaces are fixed by the owner's brief; these primitives
// carry the type ROLES that were missing (Baloo 2 was set at a uniform
// semibold everywhere, wasting its range):
//   display  — ExtraBold, tight leading: titles and prices
//   body     — Regular, generous leading: reading text
//   utility  — Medium, uppercase, wide tracking, 11px: labels and meta
//
// `tracked` is a prop rather than a locale lookup so these stay usable from
// server components: letter-spacing breaks joined Arabic, so Arabic callers
// pass tracked={false}.

const LOCKUP_SIZES = {
  md: {logo: 'h-9 w-auto', script: 'text-xl'},
  lg: {logo: 'h-9 w-auto', script: 'text-2xl'},
  xl: {logo: 'h-11 w-auto', script: 'text-3xl'}
} as const;

/**
 * The brand lockup: the shopping-bag mark beside "Yasmine" in the Betterlett
 * script over a ruled "SHOP". Always links home — on the auth screens it is
 * the only way back to the store. The mark is decorative (`alt=""`) so the
 * link's accessible name is the wordmark text.
 */
export function BrandLockup({
  size = 'lg',
  hideTextBelowSm = false,
  className
}: {
  size?: keyof typeof LOCKUP_SIZES;
  /** Header only: the crowded mobile row keeps the mark and hides the words. */
  hideTextBelowSm?: boolean;
  className?: string;
}) {
  const sizes = LOCKUP_SIZES[size];
  return (
    <Link href="/" className={cn('flex shrink-0 items-center gap-2.5', className)}>
      <img src="/brand/yasmine-logo.webp" alt="" className={sizes.logo} />
      <span className={cn('flex flex-col items-center', hideTextBelowSm && 'max-sm:sr-only')}>
        <span className={cn('font-(family-name:--font-betterlett) leading-none', sizes.script)}>
          Yasmine
        </span>
        <span className="mt-1 flex items-center gap-1.5 text-[10px] leading-none font-semibold tracking-[0.28em] text-foreground/70 uppercase">
          <span aria-hidden="true" className="h-px w-4 bg-foreground/40" />
          Shop
          <span aria-hidden="true" className="h-px w-4 bg-foreground/40" />
        </span>
      </span>
    </Link>
  );
}

/** Utility-face micro-label: section eyebrows, meta lines, slip captions. */
export function Eyebrow({
  children,
  tracked = true,
  className
}: {
  children: ReactNode;
  tracked?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'text-[11px] leading-none font-medium uppercase',
        tracked && 'tracking-[0.18em]',
        className
      )}
    >
      {children}
    </span>
  );
}

/**
 * The cachet — a rubber-stamped seal, sitting slightly off-square the way a
 * hand stamp lands on paper. Carries the store's one real promise (pay when
 * the parcel is in your hands), so it is readable text, never decoration.
 * Used at most once per surface, only where hesitation peaks.
 */
export function Stamp({
  children,
  tracked = true,
  className
}: {
  children: ReactNode;
  tracked?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex -rotate-[3.5deg] items-center rounded-lg border-2 border-current/40 px-3.5 py-2 text-[11px] leading-none font-semibold uppercase ring-1 ring-current/20 ring-inset',
        'text-(--brand-brown)',
        tracked && 'tracking-[0.16em]',
        className
      )}
    >
      {children}
    </span>
  );
}

/**
 * A delivery note: a plain surface whose bottom edge is torn into scallops
 * (see .y-slip in globals.css). Wraps order totals so the summary reads as
 * the paper slip that arrives with the parcel.
 */
export function Slip({children, className}: {children: ReactNode; className?: string}) {
  return (
    <div className={cn('y-slip relative mb-3 rounded-lg bg-card p-5 shadow-sm sm:p-6', className)}>
      {children}
    </div>
  );
}

/**
 * One line of a slip: label, dotted leader, value — the way amounts are set
 * on a printed receipt. `emphasis` promotes the row to the total.
 */
export function SlipRow({
  label,
  value,
  emphasis = false
}: {
  label: ReactNode;
  value: ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div className={cn('flex items-baseline gap-2', emphasis ? 'py-1' : 'py-1.5')}>
      <span
        className={cn(
          'shrink-0',
          emphasis ? 'text-sm font-semibold' : 'text-sm text-muted-foreground'
        )}
      >
        {label}
      </span>
      {/* The leader is what makes a receipt read as a receipt. */}
      <span
        aria-hidden="true"
        className="mb-1 min-w-6 flex-1 border-b border-dotted border-foreground/30"
      />
      <span
        className={cn(
          'shrink-0 tabular-nums',
          emphasis
            ? 'text-xl leading-none font-extrabold text-(--brand-brown)'
            : 'text-sm font-medium'
        )}
      >
        {value}
      </span>
    </div>
  );
}
