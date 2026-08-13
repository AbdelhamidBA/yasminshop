import type {ReactNode} from 'react';
import {Check, Search} from 'lucide-react';
import {Link} from '@/i18n/navigation';
import {cn} from '@/lib/utils';
import {AdminCard} from './ui';

// Layout primitives shared by every admin LIST surface (orders, products,
// clients, categories, promo-codes, sub-admins). Minimal-UI shape:
//
//   [ page header: title .......... single primary action ]
//   ┌ AdminCard (borderless, rounded-2xl, shadow-card) ──────────┐
//   │ tabs (optional)                                            │
//   │ toolbar: search ......... filters ......... result count   │
//   │ table — scrolls INSIDE the card, never the page            │
//   │ footer: pagination (optional)                              │
//   └────────────────────────────────────────────────────────────┘
//
// No 'use client': every piece is markup only, so the server pages and the
// client table components can both render them.

/** Page header row: the surface title beside its one primary action. */
export function AdminListHeader({title, action}: {title: ReactNode; action?: ReactNode}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {action}
    </div>
  );
}

/**
 * The card a list table lives in. `overflow-hidden` keeps the rounded corners
 * clipping the table's own horizontal scroller, so a wide table scrolls inside
 * the card instead of pushing the page sideways. Menus are portalled, so
 * nothing that has to escape the card is clipped by it.
 */
export function AdminTableCard({
  tabs,
  toolbar,
  footer,
  children
}: {
  tabs?: ReactNode;
  toolbar?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <AdminCard className="overflow-hidden">
      {tabs ? <div className="border-b border-dashed">{tabs}</div> : null}
      {toolbar ? (
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">{toolbar}</div>
      ) : null}
      {children}
      {footer ? <div className="border-t border-dashed p-4">{footer}</div> : null}
    </AdminCard>
  );
}

/** Search box shell: a magnifier sits in the field's leading gutter. */
export function AdminSearchField({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('relative w-full', className)}>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
      {children}
    </div>
  );
}

/** Class for the search Input itself — leaves room for the magnifier. */
export const adminSearchInputClass = 'h-10 rounded-lg bg-muted ps-9 shadow-none';

/**
 * Toolbar filter chip (the archived toggles). Stays a Link so the filter is a
 * real URL — only the presentation changes; the tick reserves its own space so
 * toggling never shifts the row.
 */
export function AdminFilterToggle({
  href,
  active,
  children
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      data-active={active || undefined}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        active
          ? 'bg-(--admin-primary-soft) text-(--admin-primary-dark)'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      <Check aria-hidden="true" className={cn('size-4', !active && 'opacity-0')} />
      {children}
    </Link>
  );
}

/** Result counter — the toolbar's quiet utility face. */
export function AdminResultCount({children}: {children: ReactNode}) {
  return <span className="text-sm whitespace-nowrap text-muted-foreground">{children}</span>;
}

/** Trailing toolbar group (count + filters), pushed opposite the search box. */
export function AdminToolbarEnd({children}: {children: ReactNode}) {
  return <div className="flex flex-wrap items-center gap-3 sm:ms-auto">{children}</div>;
}

/**
 * Two-line entity cell: a monogram/thumbnail beside a bold primary line over a
 * muted secondary one. Both lines stay real text nodes, so a row's accessible
 * name still contains the name AND the reference/e-mail/slug it used to show
 * in its own column.
 */
export function EntityCell({
  media,
  primary,
  secondary,
  secondaryDir,
  badge,
  className
}: {
  media?: ReactNode;
  primary: ReactNode;
  secondary?: ReactNode;
  secondaryDir?: 'ltr';
  badge?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      {media}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{primary}</span>
          {badge}
        </div>
        {secondary === null || secondary === undefined ? null : (
          <div dir={secondaryDir} className="mt-0.5 text-xs text-muted-foreground">
            {secondary}
          </div>
        )}
      </div>
    </div>
  );
}
