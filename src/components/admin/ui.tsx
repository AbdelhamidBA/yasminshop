import type {ReactNode} from 'react';
import {cn} from '@/lib/utils';

// Admin design primitives (Minimal-UI-flavoured, see the .theme-minimal block
// in globals.css). Three ideas carry the whole dashboard:
//
//   1. Surfaces separate by SHADOW, not by rules — cards are borderless, white
//      and rounded-2xl on a faintly grey page.
//   2. Colour is applied SOFT — a semantic colour at 16% behind its own solid
//      ink. Status labels, icon boxes and chart accents all use that pair, so
//      the palette never shouts.
//   3. Labels are small, bold and tracked; numbers are large and tabular.
//
// No 'use client': these render from server and client trees alike.

export type AdminTone = 'primary' | 'info' | 'success' | 'warning' | 'error' | 'neutral';

// Solid ink + its 16% wash. Written out (not interpolated) so Tailwind keeps
// the classes; the vars themselves flip for dark mode in globals.css.
const TONE_SOFT: Record<AdminTone, string> = {
  primary: 'bg-(--admin-primary-soft) text-(--admin-primary-dark)',
  info: 'bg-(--admin-info-soft) text-(--admin-info)',
  success: 'bg-(--admin-success-soft) text-(--admin-success)',
  warning: 'bg-(--admin-warning-soft) text-(--admin-warning)',
  error: 'bg-(--admin-error-soft) text-(--admin-error)',
  neutral: 'bg-(--admin-neutral-soft) text-muted-foreground'
};

/** Borderless card: the dashboard's only surface. */
export function AdminCard({
  className,
  children
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('shadow-card rounded-2xl bg-card', className)}>{children}</div>
  );
}

/** Small bold tracked caption above a value or a card section. */
export function Overline({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'text-[12px] leading-none font-bold tracking-[0.09em] text-muted-foreground uppercase',
        className
      )}
    >
      {children}
    </span>
  );
}

/** Soft status chip — the kit's Label component. */
export function StatusLabel({
  tone = 'neutral',
  className,
  children
}: {
  tone?: AdminTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center rounded-md px-2 text-xs font-bold whitespace-nowrap',
        TONE_SOFT[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/** Tinted rounded square holding a metric's icon. */
export function IconBox({
  tone = 'primary',
  className,
  children
}: {
  tone?: AdminTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex size-12 shrink-0 items-center justify-center rounded-2xl',
        TONE_SOFT[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/** Circular monogram for a person cell in a table. */
export function Avatar({name, className}: {name: string; className?: string}) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-(--admin-neutral-soft) text-sm font-bold text-muted-foreground',
        className
      )}
    >
      {initial}
    </span>
  );
}
