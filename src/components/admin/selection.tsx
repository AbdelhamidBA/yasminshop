'use client';

import {useCallback, useMemo, useState, type ReactNode} from 'react';
import {X} from 'lucide-react';
import {Checkbox} from '@/components/ui/checkbox';
import {cn} from '@/lib/utils';

// Row selection + mass actions, shared by every admin list.
//
// The pattern: a checkbox column, a header checkbox that selects the rows
// currently on screen (indeterminate while partial), and a selection bar that
// REPLACES the toolbar as soon as anything is picked — so the actions appear
// exactly where the user is looking, and the count is always visible before a
// destructive confirm.
//
// Selection is deliberately page-scoped: it holds the ids the operator can
// actually see. "Select all" never means "every row in the database" — a mass
// action must never be bigger than what was reviewed.

export function useRowSelection(visibleIds: string[]) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());

  // Rows can disappear under the selection (filter change, archive, a new
  // page), so the working set is always intersected with what is on screen.
  const effective = useMemo(() => {
    const visible = new Set(visibleIds);
    return new Set([...selected].filter((id) => visible.has(id)));
  }, [selected, visibleIds]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      const visible = new Set(visibleIds);
      const picked = [...prev].filter((id) => visible.has(id)).length;
      return picked === visibleIds.length ? new Set() : new Set(visibleIds);
    });
  }, [visibleIds]);

  const clear = useCallback(() => setSelected(new Set()), []);

  const ids = useMemo(() => [...effective], [effective]);

  return {
    ids,
    count: ids.length,
    has: (id: string) => effective.has(id),
    toggle,
    toggleAll,
    clear,
    allSelected: visibleIds.length > 0 && ids.length === visibleIds.length,
    someSelected: ids.length > 0 && ids.length < visibleIds.length
  };
}

export type RowSelection = ReturnType<typeof useRowSelection>;

/** Header checkbox: selects/clears every row on screen. */
export function SelectAllCheckbox({
  selection,
  label,
  disabled
}: {
  selection: RowSelection;
  label: string;
  disabled?: boolean;
}) {
  return (
    <Checkbox
      aria-label={label}
      disabled={disabled}
      checked={selection.allSelected}
      indeterminate={selection.someSelected}
      onCheckedChange={() => selection.toggleAll()}
    />
  );
}

/** Per-row checkbox. `label` names the row so the control is announceable. */
export function RowCheckbox({
  selection,
  id,
  label
}: {
  selection: RowSelection;
  id: string;
  label: string;
}) {
  return (
    <Checkbox
      aria-label={label}
      checked={selection.has(id)}
      onCheckedChange={() => selection.toggle(id)}
    />
  );
}

/**
 * The selection bar. Sits where the toolbar was, tinted with the brand wash so
 * it reads as a mode rather than a row of extra buttons.
 */
export function SelectionBar({
  count,
  countLabel,
  clearLabel,
  onClear,
  children
}: {
  count: number;
  /** Already-pluralised "N selected" string. */
  countLabel: string;
  clearLabel: string;
  onClear: () => void;
  /** The mass actions for this table. */
  children: ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div
      role="region"
      aria-label={countLabel}
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-xl bg-(--admin-primary-soft) px-4 py-3'
      )}
    >
      <button
        type="button"
        onClick={onClear}
        aria-label={clearLabel}
        className="inline-flex size-7 items-center justify-center rounded-lg text-(--brand-brown) transition-colors hover:bg-background/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <X className="size-4" />
      </button>
      <span className="text-sm font-bold text-(--brand-brown)">{countLabel}</span>
      <span className="ms-auto flex flex-wrap items-center gap-2">{children}</span>
    </div>
  );
}
