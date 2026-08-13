'use client';

import {useState, useTransition} from 'react';
import {CornerDownRight, Plus} from 'lucide-react';
import {useLocale, useTranslations} from 'next-intl';
import {toast} from 'sonner';
import {Button} from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {AdminEmptyState} from '@/components/admin/empty-state';
import {RowActionItem, RowActions, RowActionSeparator} from '@/components/admin/row-actions';
import {
  AdminFilterToggle, AdminListHeader, AdminResultCount, AdminTableCard, AdminToolbarEnd,
  EntityCell
} from '@/components/admin/list-shell';
import {
  RowCheckbox, SelectAllCheckbox, SelectionBar, useRowSelection
} from '@/components/admin/selection';
import {Avatar, StatusLabel} from '@/components/admin/ui';
import type {CategoryRow} from '@/server/categories';
import {archiveCategories, archiveCategory, restoreCategories, restoreCategory} from './actions';
import {CategoryFormDialog, type EditableCategory} from './category-form-dialog';

type ParentOption = {id: string; nameFr: string; nameAr: string};

export function CategoriesTable({
  categories,
  parentOptions,
  isAdmin,
  includeArchived
}: {
  categories: CategoryRow[];
  parentOptions: ParentOption[];
  isAdmin: boolean;
  includeArchived: boolean;
}) {
  const t = useTranslations('admin.categories');
  const tList = useTranslations('admin.list');
  const tSel = useTranslations('admin.selection');
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<EditableCategory | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);

  const name = (row: {nameFr: string; nameAr: string}) => (locale === 'ar' ? row.nameAr : row.nameFr);

  // The tree is rendered flat, so selection is fed the SAME flat list of ids the
  // operator can see — roots first, each followed by its sub-categories.
  const rowIds = categories.flatMap((root) => [root.id, ...root.children.map((c) => c.id)]);
  // Roots + their children — the tree is rendered flat, so the count is the
  // number of rows the table actually shows.
  const rowCount = rowIds.length;
  // Mass actions are ADMIN-only, so the whole selection column is absent for a
  // SUB_ADMIN — the server re-checks regardless.
  const selection = useRowSelection(isAdmin ? rowIds : []);

  function runBulk(
    action: (ids: string[]) => Promise<{ok: boolean; error?: string}>,
    okMessage: string,
    tone: 'info' | 'success'
  ) {
    const ids = selection.ids;
    startTransition(async () => {
      const result = await action(ids);
      if (result.ok) {
        // Same severity split as the per-row actions: archiving hides records
        // (info), restoring brings them back (success).
        toast[tone](okMessage);
        selection.clear();
      } else {
        toast.error(t(`errors.${result.error}` as never));
      }
    });
  }

  function runArchive(id: string) {
    startTransition(async () => {
      const result = await archiveCategory(id);
      // Archiving hides a record rather than achieving something — info.
      if (result.ok) toast.info(t('archivedToast'));
      else toast.error(t(`errors.${result.error}` as never));
    });
  }

  function runRestore(id: string) {
    startTransition(async () => {
      const result = await restoreCategory(id);
      if (result.ok) toast.success(t('restoredToast'));
      else toast.error(t(`errors.${result.error}` as never));
    });
  }

  function renderRow(row: CategoryRow | CategoryRow['children'][number], isChild: boolean) {
    const archived = row.archivedAt !== null;
    return (
      <TableRow key={row.id} data-selected={selection.has(row.id) || undefined}>
        {isAdmin && (
          // aria-label on the CELL, not just the checkbox: a cell takes its
          // accessible name from its contents, so an unlabelled one would be
          // announced (and matched by getByRole('cell', {name})) as
          // "Sélectionner <catégorie>" — colliding with the name cell of the
          // very same row. The checkbox keeps its own precise label.
          <TableCell className="w-10" aria-label={tSel('column')}>
            <RowCheckbox
              selection={selection}
              id={row.id}
              label={tSel('selectRow', {name: name(row)})}
            />
          </TableCell>
        )}
        {/* Name over slug. Children keep their indent and swap the monogram for
            a branch glyph, so the hierarchy still reads at a glance. */}
        <TableCell className={isChild ? 'ps-10' : undefined}>
          <EntityCell
            media={
              isChild ? (
                <CornerDownRight
                  aria-hidden="true"
                  className="size-5 shrink-0 text-muted-foreground"
                />
              ) : (
                <Avatar name={name(row)} />
              )
            }
            primary={name(row)}
            secondary={row.slug}
            secondaryDir="ltr"
            badge={archived ? <StatusLabel tone="neutral">{t('archived')}</StatusLabel> : undefined}
          />
        </TableCell>
        <TableCell className="tabular-nums">{row._count.products}</TableCell>
        {isAdmin && (
          <TableCell className="text-end">
            <RowActions label={t('actions')} disabled={pending}>
              <RowActionItem
                action="edit"
                onClick={() =>
                  setEditing({
                    id: row.id,
                    nameFr: row.nameFr,
                    nameAr: row.nameAr,
                    parentId: 'parentId' in row ? row.parentId : null
                  })
                }
              >
                {t('edit')}
              </RowActionItem>
              <RowActionSeparator />
              {archived ? (
                <RowActionItem action="restore" onClick={() => runRestore(row.id)}>
                  {t('restore')}
                </RowActionItem>
              ) : (
                <RowActionItem action="archive" onClick={() => setConfirmArchiveId(row.id)}>
                  {t('archive')}
                </RowActionItem>
              )}
            </RowActions>
          </TableCell>
        )}
      </TableRow>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <AdminListHeader
        title={t('title')}
        action={
          isAdmin ? (
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" /> {t('add')}
            </Button>
          ) : undefined
        }
      />

      <AdminTableCard
        toolbar={
          selection.count > 0 ? (
            // The selection bar REPLACES the toolbar: the actions appear where
            // the operator is already looking, with the count always in view.
            <SelectionBar
              count={selection.count}
              countLabel={tSel('count', {count: selection.count})}
              clearLabel={tSel('clear')}
              onClear={selection.clear}
            >
              {includeArchived ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => runBulk(restoreCategories, t('restoredToast'), 'success')}
                >
                  {tSel('restore')}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => runBulk(archiveCategories, t('archivedToast'), 'info')}
                >
                  {tSel('archive')}
                </Button>
              )}
            </SelectionBar>
          ) : (
            <AdminToolbarEnd>
              <AdminResultCount>{tList('results', {count: rowCount})}</AdminResultCount>
              <AdminFilterToggle
                href={includeArchived ? '/admin/categories' : '/admin/categories?archived=1'}
                active={includeArchived}
              >
                {t('showArchived')}
              </AdminFilterToggle>
            </AdminToolbarEnd>
          )
        }
      >
        {categories.length === 0 ? (
          <AdminEmptyState>{t('empty')}</AdminEmptyState>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {isAdmin && (
                  <TableHead className="w-10">
                    <SelectAllCheckbox selection={selection} label={tSel('selectAll')} />
                  </TableHead>
                )}
                <TableHead>{t('name')}</TableHead>
                <TableHead>{t('products')}</TableHead>
                {isAdmin && <TableHead className="text-end">{t('actions')}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.flatMap((root) => [
                renderRow(root, false),
                ...root.children.map((child) => renderRow(child, true))
              ])}
            </TableBody>
          </Table>
        )}
      </AdminTableCard>

      {isAdmin && (
        <>
          <CategoryFormDialog
            open={creating}
            onOpenChange={setCreating}
            parentOptions={parentOptions}
            category={null}
          />
          <CategoryFormDialog
            open={editing !== null}
            onOpenChange={(open) => !open && setEditing(null)}
            parentOptions={parentOptions.filter((p) => p.id !== editing?.id)}
            category={editing}
          />
          <AlertDialog open={confirmArchiveId !== null} onOpenChange={(open) => !open && setConfirmArchiveId(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('confirmArchiveTitle')}</AlertDialogTitle>
                <AlertDialogDescription>{t('confirmArchiveBody')}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    if (confirmArchiveId) runArchive(confirmArchiveId);
                    setConfirmArchiveId(null);
                  }}
                >
                  {t('archive')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}
