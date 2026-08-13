'use client';

import type {ComponentProps, ReactNode} from 'react';
import {
  Archive, ArchiveRestore, Ban, CircleCheck, Eye, MoreHorizontal, Pencil, Trash2
} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {cn} from '@/lib/utils';

// The "…" row action menu every admin LIST shares (orders, products, clients,
// categories, promo codes, sub-admins). It lives here rather than at each table
// so the six menus cannot drift — and because a PORTALLED popup needs three
// things the shared ui/dropdown-menu primitive cannot give it (that primitive
// is storefront-owned too: the header account menu and the category nav use it,
// so it is left untouched and every admin-only decision is made here):
//
//   1. THE TOKEN SCOPE. The popup renders at <body>, outside the admin
//      subtree, so it carries `theme-minimal` itself — the same precedent as
//      dialog.tsx and the storefront's own menus. Without it the popup fell
//      back to the ROOT shadcn palette: a grey highlight instead of the warm
//      wash, a cold near-black surface in dark mode against warm-brown cards,
//      and — because `--font-sans` is only ever given a value inside a theme
//      scope — every label in the browser's SERIF.
//   2. CONTENT WIDTH. The primitive sizes a popup to its anchor
//      (`w-(--anchor-width)`, floored at min-w-32). Anchored on a 32px icon
//      button that is a hard 128px box, which wrapped 'Modifier la catégorie'
//      onto two lines. Here the menu is sized by its content instead.
//   3. THE KIT'S SURFACE. Minimal UI separates by SHADOW, not by a rule:
//      shadow-float on a borderless rounded popup, no ring.
//
// Icons are a fixed VOCABULARY rather than a free prop, so the same action
// always carries the same glyph at the same size across all six tables.
const ROW_ACTION_ICONS = {
  view: Eye,
  edit: Pencil,
  archive: Archive,
  restore: ArchiveRestore,
  enable: CircleCheck,
  disable: Ban,
  delete: Trash2
} as const;

export type RowActionKind = keyof typeof ROW_ACTION_ICONS;

/**
 * The trigger + its portalled popup. `label` is the trigger's accessible name
 * ('Actions'), which the e2e specs click by, so it stays a plain aria-label on
 * a real button.
 */
export function RowActions({
  label,
  disabled,
  children
}: {
  label: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          // ghost already carries aria-expanded:bg-muted, so the trigger reads
          // as active while its menu is open (as does the row behind it).
          <Button variant="ghost" size="icon" aria-label={label} disabled={disabled}>
            <MoreHorizontal className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="theme-minimal w-auto min-w-40 rounded-xl p-1.5 shadow-float ring-0"
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * One action. The TEXT is the caller's (the e2e specs click these by name) and
 * the icon is decorative, so it is aria-hidden and never joins the accessible
 * name. 'delete' is the only destructive kind: it takes the primitive's
 * destructive variant, whose `--destructive` inside `theme-minimal` IS the
 * admin error ink — archive/restore stay neutral by design, since hiding a
 * record is reversible.
 */
export function RowActionItem({
  action,
  className,
  children,
  ...props
}: ComponentProps<typeof DropdownMenuItem> & {action: RowActionKind}) {
  const Icon = ROW_ACTION_ICONS[action];
  return (
    <DropdownMenuItem
      variant={action === 'delete' ? 'destructive' : 'default'}
      className={cn(
        // Roomy (36px) rows on the admin's quiet hover wash — the same
        // hover the sidebar and the dialog close button use.
        'gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium',
        'focus:bg-(--admin-neutral-soft) focus:text-foreground',
        // Icons lead in secondary ink and brighten with the row they label.
        '[&>svg]:text-muted-foreground',
        // Bracket form on purpose: bare `data-disabled:` is a Tailwind v4
        // built-in compiling to [data-disabled="true"], and Base UI writes the
        // attribute EMPTY — so the primitive's own disabled affordance never
        // matched. [data-disabled] matches presence, whatever the value.
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className
      )}
      {...props}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      {children}
    </DropdownMenuItem>
  );
}

/** Divider between the edit group and the lifecycle (archive/restore) group. */
export function RowActionSeparator({className}: {className?: string}) {
  return <DropdownMenuSeparator className={cn('-mx-1.5 my-1', className)} />;
}
