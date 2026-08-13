'use client';

import {useState, useTransition} from 'react';
import {Plus, Ticket} from 'lucide-react';
import {useLocale, useTranslations} from 'next-intl';
import {toast} from 'sonner';
import {Button} from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import {Switch} from '@/components/ui/switch';
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
import {IconBox, StatusLabel} from '@/components/admin/ui';
import type {PromoCodeRow} from '@/server/promo-codes';
import {
  archivePromoCode, archivePromoCodes, disablePromoCodes, enablePromoCodes, restorePromoCode,
  restorePromoCodes, togglePromoCode
} from './actions';
import {PromoCodeFormDialog, type EditablePromoCode} from './promo-code-form-dialog';

export function PromoCodesTable({
  promoCodes,
  isAdmin,
  includeArchived
}: {
  promoCodes: PromoCodeRow[];
  isAdmin: boolean;
  includeArchived: boolean;
}) {
  const t = useTranslations('admin.promoCodesPage');
  const tList = useTranslations('admin.list');
  const tSel = useTranslations('admin.selection');
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<EditablePromoCode | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);
  // Mass actions are ADMIN-only, so the whole selection column is absent for a
  // SUB_ADMIN — the server re-checks regardless.
  const selection = useRowSelection(isAdmin ? promoCodes.map((row) => row.id) : []);

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
        // Same severity split as the per-row actions: archiving/deactivating is
        // a state change (info), restoring/activating an achievement (success).
        toast[tone](okMessage);
        selection.clear();
      } else {
        toast.error(t(`errors.${result.error}` as never));
      }
    });
  }

  function runToggle(id: string, active: boolean) {
    startTransition(async () => {
      const result = await togglePromoCode(id, active);
      // Activating is an achievement, deactivating is a state change — the
      // severity follows the direction, the message strings are untouched.
      if (result.ok) {
        if (active) toast.success(t('toggledOn'));
        else toast.info(t('toggledOff'));
      }
      else toast.error(t(`errors.${result.error}` as never));
    });
  }

  function runArchive(id: string) {
    startTransition(async () => {
      const result = await archivePromoCode(id);
      // Archiving hides a record rather than achieving something — info.
      if (result.ok) toast.info(t('archivedToast'));
      else toast.error(t(`errors.${result.error}` as never));
    });
  }

  function runRestore(id: string) {
    startTransition(async () => {
      const result = await restorePromoCode(id);
      if (result.ok) toast.success(t('restoredToast'));
      else toast.error(t(`errors.${result.error}` as never));
    });
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
              {/* Enable/disable is the per-row Switch applied to the selection —
                  same single `active` write, same two toasts. */}
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => runBulk(enablePromoCodes, t('toggledOn'), 'success')}
              >
                {t('enable')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => runBulk(disablePromoCodes, t('toggledOff'), 'info')}
              >
                {t('disable')}
              </Button>
              {includeArchived ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => runBulk(restorePromoCodes, t('restoredToast'), 'success')}
                >
                  {tSel('restore')}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => runBulk(archivePromoCodes, t('archivedToast'), 'info')}
                >
                  {tSel('archive')}
                </Button>
              )}
            </SelectionBar>
          ) : (
            <AdminToolbarEnd>
              <AdminResultCount>{tList('results', {count: promoCodes.length})}</AdminResultCount>
              <AdminFilterToggle
                href={includeArchived ? '/admin/promo-codes' : '/admin/promo-codes?archived=1'}
                active={includeArchived}
              >
                {t('showArchived')}
              </AdminFilterToggle>
            </AdminToolbarEnd>
          )
        }
      >
        {promoCodes.length === 0 ? (
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
                <TableHead>{t('code')}</TableHead>
                <TableHead>{t('percentOff')}</TableHead>
                <TableHead>{t('active')}</TableHead>
                <TableHead>{t('expiresAt')}</TableHead>
                {isAdmin && <TableHead className="text-end">{t('actions')}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {promoCodes.map((row) => {
                const archived = row.archivedAt !== null;
                return (
                  <TableRow key={row.id} data-selected={selection.has(row.id) || undefined}>
                    {isAdmin && (
                      // aria-label on the CELL: a cell is named from its
                      // contents, so an unlabelled one would announce (and be
                      // matched by getByRole('cell', {name})) as
                      // "Sélectionner <code>", colliding with the code cell of
                      // the same row. The checkbox keeps its own precise label.
                      <TableCell className="w-10" aria-label={tSel('column')}>
                        <RowCheckbox
                          selection={selection}
                          id={row.id}
                          label={tSel('selectRow', {name: row.code})}
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      <EntityCell
                        media={
                          <IconBox tone="primary" className="size-10 rounded-xl">
                            <Ticket className="size-5" />
                          </IconBox>
                        }
                        primary={
                          <span dir="ltr" className="font-mono">
                            {row.code}
                          </span>
                        }
                        badge={
                          archived ? <StatusLabel tone="neutral">{t('archived')}</StatusLabel> : undefined
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <StatusLabel tone="primary">
                        <span dir="ltr">-{row.percentOff}%</span>
                      </StatusLabel>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={row.active}
                        disabled={!isAdmin || pending}
                        onCheckedChange={
                          isAdmin ? (checked) => runToggle(row.id, checked) : undefined
                        }
                        aria-label={t('active')}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.expiresAt ? dateFormatter.format(row.expiresAt) : t('noExpiry')}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-end">
                        <RowActions label={t('actions')} disabled={pending}>
                          <RowActionItem
                            action="edit"
                            onClick={() =>
                              setEditing({
                                id: row.id,
                                code: row.code,
                                percentOff: row.percentOff,
                                active: row.active,
                                expiresAt: row.expiresAt
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
                            <RowActionItem
                              action="archive"
                              onClick={() => setConfirmArchiveId(row.id)}
                            >
                              {t('archive')}
                            </RowActionItem>
                          )}
                        </RowActions>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </AdminTableCard>

      {isAdmin && (
        <>
          <PromoCodeFormDialog open={creating} onOpenChange={setCreating} promoCode={null} />
          <PromoCodeFormDialog
            open={editing !== null}
            onOpenChange={(open) => !open && setEditing(null)}
            promoCode={editing}
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
