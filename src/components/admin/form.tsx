import type {ReactNode} from 'react';
import {Label} from '@/components/ui/label';
import {cn} from '@/lib/utils';
import {AdminCard, Overline} from './ui';

// Layout language for the admin's STANDALONE FORMS and DETAIL SCREENS, built
// on the primitives in ./ui.tsx. Four rules carry every screen:
//
//   1. A form is a STACK OF TITLED CARDS, never one long undifferentiated
//      column — each group is a borderless rounded-2xl card (AdminCard) headed
//      by a small bold tracked caption (Overline) on the faintly grey page.
//   2. Controls are ROOMY (h-11) and softly rounded; the field label is small
//      and secondary-ink, and help text / errors sit directly under the field.
//   3. Actions live in a footer row aligned to the LOGICAL END, the primary one
//      solid with the primary-tinted shadow.
//   4. Nothing is a hard bordered box — separation is shadow and whitespace.
//
// No 'use client': these render from server and client trees alike. Layout
// only — no state, no behaviour.

/** Roomy admin control: pair with Input / SelectTrigger. */
export const adminControl = 'h-11 rounded-lg px-3';
/**
 * The popup half of an admin Select. It PORTALS to <body>, outside the admin
 * subtree, so it carries the token scope itself — same precedent as dialog.tsx
 * and the row action menus — and takes the kit's float shadow in place of the
 * shared primitive's hairline ring, because Minimal surfaces separate by
 * shadow rather than by a rule.
 */
export const adminSelectContent = 'theme-minimal rounded-xl shadow-float ring-0';
/** Same language for a multi-line control. */
export const adminTextarea = 'min-h-24 rounded-lg px-3 py-2.5';
/** Solid primary action with the kit's primary-tinted shadow. */
export const adminPrimaryAction = 'h-11 px-5 shadow-[var(--shadow-primary)]';
/** Quiet companion action, same height so the footer row reads as one band. */
export const adminQuietAction = 'h-11 px-5';

/**
 * Titled card. `flush` keeps the card's vertical padding but lets the body
 * bleed to the card edges (tables), so the heading still sits on the inset.
 */
export function Panel({
  title,
  description,
  actions,
  flush,
  className,
  bodyClassName,
  children
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  flush?: boolean;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  const hasHeader = title !== undefined || actions !== undefined;
  return (
    <AdminCard className={cn(flush ? 'overflow-hidden py-5 sm:py-6' : 'p-5 sm:p-6', className)}>
      {hasHeader && (
        <div
          className={cn(
            'mb-5 flex flex-wrap items-start justify-between gap-3',
            flush && 'px-5 sm:px-6'
          )}
        >
          {/* basis-64 is what makes `flex-wrap` above do its job: without an
              intrinsic basis the title column just shrinks to nothing beside a
              nowrap status chip (the description collapsed to a ~65px ribbon on
              a 390px screen). Below ~256px + chip the chip drops to its own
              line and the copy gets the full card width; above it, nothing
              changes — flex-1 still fills the row. */}
          <div className="flex min-w-0 flex-1 basis-64 flex-col gap-1.5">
            {title !== undefined && (
              <h2>
                <Overline>{title}</Overline>
              </h2>
            )}
            {description !== undefined && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          {actions !== undefined && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </AdminCard>
  );
}

/** Panel whose body is the two-column field grid. */
export function FormSection({
  title,
  description,
  bodyClassName,
  className,
  children
}: {
  title?: ReactNode;
  description?: ReactNode;
  bodyClassName?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Panel
      title={title}
      description={description}
      className={className}
      bodyClassName={cn('grid gap-x-5 gap-y-5 sm:grid-cols-2', bodyClassName)}
    >
      {children}
    </Panel>
  );
}

/**
 * One field: small secondary label, roomy control, then its error (or, when
 * there is none, its hint) directly underneath. `htmlFor`/`id` association is
 * preserved so every label stays a queryable accessible name.
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  className,
  children
}: {
  label?: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-2', className)}>
      {label !== undefined && (
        <Label htmlFor={htmlFor} className="text-[13px] font-semibold text-muted-foreground">
          {label}
        </Label>
      )}
      {children}
      {error ?? (hint !== undefined ? <p className="text-xs text-muted-foreground">{hint}</p> : null)}
    </div>
  );
}

/** Footer row: quiet actions first, primary last, aligned to the logical end. */
export function FormActions({className, children}: {className?: string; children: ReactNode}) {
  return (
    <div className={cn('flex flex-wrap items-center justify-end gap-3', className)}>{children}</div>
  );
}

/** Soft informational strip — the 16% tint behind its own ink, no border. */
export function SoftNote({
  tone = 'info',
  className,
  children
}: {
  tone?: 'info' | 'warning' | 'neutral';
  className?: string;
  children: ReactNode;
}) {
  const tones = {
    info: 'bg-(--admin-info-soft) text-(--admin-info)',
    warning: 'bg-(--admin-warning-soft) text-(--admin-warning)',
    neutral: 'bg-(--admin-neutral-soft) text-muted-foreground'
  } as const;
  return (
    <p className={cn('rounded-xl px-4 py-3 text-sm font-medium', tones[tone], className)}>
      {children}
    </p>
  );
}

/** Page header block: title + status + meta on one band, actions at the end. */
export function PageHeader({
  title,
  meta,
  badges,
  actions,
  back,
  className
}: {
  title: ReactNode;
  meta?: ReactNode;
  badges?: ReactNode;
  actions?: ReactNode;
  back?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('flex flex-wrap items-center gap-x-3 gap-y-3', className)}>
      {back}
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          {title}
          {badges}
        </div>
        {meta !== undefined && <div className="text-sm text-muted-foreground">{meta}</div>}
      </div>
      {actions !== undefined && (
        <div className="ms-auto flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </header>
  );
}

/** The h1 every admin form/detail screen shares. */
export function PageTitle({
  className,
  children,
  ...rest
}: {className?: string; children: ReactNode} & {dir?: string}) {
  return (
    <h1 className={cn('text-2xl font-bold tracking-tight', className)} {...rest}>
      {children}
    </h1>
  );
}
