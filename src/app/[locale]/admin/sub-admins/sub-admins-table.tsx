'use client';

import {type ReactNode, useState, useTransition} from 'react';
import {MoreHorizontal, Plus} from 'lucide-react';
import {useSearchParams} from 'next/navigation';
import {useLocale, useTranslations} from 'next-intl';
import {toast} from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import {Button} from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {AdminEmptyState} from '@/components/admin/empty-state';
import {
  AdminFilterToggle, AdminListHeader, AdminResultCount, AdminTableCard, AdminToolbarEnd,
  EntityCell
} from '@/components/admin/list-shell';
import {
  RowCheckbox, SelectAllCheckbox, SelectionBar, useRowSelection
} from '@/components/admin/selection';
import {Avatar, StatusLabel} from '@/components/admin/ui';
import type {SubAdminRow} from '@/server/sub-admins';
import {archiveSubAdmin, archiveSubAdmins, restoreSubAdmin, restoreSubAdmins} from './actions';
import {SubAdminCreateDialog} from './sub-admin-create-dialog';
import {SubAdminEditDialog, type EditableSubAdmin} from './sub-admin-edit-dialog';

// The whole /admin/sub-admins page is ADMIN-only (page notFound guard + every
// action requireAdmin), so — unlike the staff-visible clients table — there is
// no isAdmin prop: every control is always rendered.
export function SubAdminsTable({
  subAdmins,
  total,
  includeArchived,
  search,
  pagination
}: {
  subAdmins: SubAdminRow[];
  total: number;
  includeArchived: boolean;
  search?: ReactNode;
  pagination?: ReactNode;
}) {
  const t = useTranslations('subAdmins');
  const tList = useTranslations('admin.list');
  const tSel = useTranslations('admin.selection');
  const locale = useLocale();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<EditableSubAdmin | null>(null);
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);
  // The page itself is ADMIN-only (notFound for a SUB_ADMIN) and every action
  // re-checks requireAdmin, so the selection column is always rendered here.
  const selection = useRowSelection(subAdmins.map((row) => row.id));

  const dateFormatter = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-TN' : 'fr-TN', {
    dateStyle: 'medium'
  });

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

  // Archived-toggle link preserves the search (clients-table idiom).
  const toggleParams = new URLSearchParams();
  const q = searchParams.get('q');
  if (q) toggleParams.set('q', q);
  if (!includeArchived) toggleParams.set('archived', '1');
  const toggleHref = `/admin/sub-admins${toggleParams.size ? `?${toggleParams}` : ''}`;

  function runArchive(id: string) {
    startTransition(async () => {
      const result = await archiveSubAdmin(id);
      // Archiving hides a record rather than achieving something — info.
      if (result.ok) toast.info(t('archivedToast'));
      else toast.error(t(`errors.${result.error}` as never));
    });
  }

  function runRestore(id: string) {
    startTransition(async () => {
      const result = await restoreSubAdmin(id);
      if (result.ok) toast.success(t('restoredToast'));
      else toast.error(t(`errors.${result.error}` as never));
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <AdminListHeader
        title={t('title')}
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" /> {t('add')}
          </Button>
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
                  onClick={() => runBulk(restoreSubAdmins, t('restoredToast'), 'success')}
                >
                  {tSel('restore')}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => runBulk(archiveSubAdmins, t('archivedToast'), 'info')}
                >
                  {tSel('archive')}
                </Button>
              )}
            </SelectionBar>
          ) : (
            <>
              {search}
              <AdminToolbarEnd>
                <AdminResultCount>{tList('results', {count: total})}</AdminResultCount>
                <AdminFilterToggle href={toggleHref} active={includeArchived}>
                  {t('showArchived')}
                </AdminFilterToggle>
              </AdminToolbarEnd>
            </>
          )
        }
        footer={pagination}
      >
        {subAdmins.length === 0 ? (
          <AdminEmptyState>{t('empty')}</AdminEmptyState>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <SelectAllCheckbox selection={selection} label={tSel('selectAll')} />
                </TableHead>
                <TableHead>{t('name')}</TableHead>
                <TableHead>{t('phone')}</TableHead>
                <TableHead>{t('joined')}</TableHead>
                <TableHead className="text-end">{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subAdmins.map((subAdmin) => {
                const archived = subAdmin.archivedAt !== null;
                return (
                  <TableRow key={subAdmin.id} data-selected={selection.has(subAdmin.id) || undefined}>
                    {/* aria-label on the CELL: a cell is named from its contents,
                        so an unlabelled one would announce (and be matched by
                        getByRole('cell', {name})) as "Sélectionner <nom>",
                        colliding with the name cell of the same row. The
                        checkbox keeps its own precise label. */}
                    <TableCell className="w-10" aria-label={tSel('column')}>
                      <RowCheckbox
                        selection={selection}
                        id={subAdmin.id}
                        label={tSel('selectRow', {name: subAdmin.name})}
                      />
                    </TableCell>
                    {/* Monogram + name over e-mail (the e-mail's own column is
                        folded in here — its text node is unchanged). */}
                    <TableCell>
                      <EntityCell
                        media={<Avatar name={subAdmin.name} />}
                        primary={subAdmin.name}
                        secondary={subAdmin.email}
                        secondaryDir="ltr"
                        badge={
                          archived ? <StatusLabel tone="neutral">{t('archived')}</StatusLabel> : undefined
                        }
                      />
                    </TableCell>
                    <TableCell dir="ltr" className="text-muted-foreground">
                      {subAdmin.phone ?? '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {dateFormatter.format(subAdmin.createdAt)}
                    </TableCell>
                    <TableCell className="text-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={t('actions')}
                              disabled={pending}
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end">
                          {archived ? (
                            <DropdownMenuItem onClick={() => runRestore(subAdmin.id)}>
                              {t('restore')}
                            </DropdownMenuItem>
                          ) : (
                            <>
                              <DropdownMenuItem
                                onClick={() =>
                                  setEditing({
                                    id: subAdmin.id,
                                    name: subAdmin.name,
                                    email: subAdmin.email,
                                    phone: subAdmin.phone
                                  })
                                }
                              >
                                {t('edit')}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setConfirmArchiveId(subAdmin.id)}>
                                {t('archive')}
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </AdminTableCard>

      <SubAdminCreateDialog open={creating} onOpenChange={setCreating} />
      <SubAdminEditDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        subAdmin={editing}
      />
      <AlertDialog
        open={confirmArchiveId !== null}
        onOpenChange={(open) => !open && setConfirmArchiveId(null)}
      >
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
    </div>
  );
}
