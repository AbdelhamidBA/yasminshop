'use client';

import {type ReactNode, useState, useTransition} from 'react';
import {Eye} from 'lucide-react';
import {useLocale, useTranslations} from 'next-intl';
import {toast} from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import {Button} from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {AdminEmptyState} from '@/components/admin/empty-state';
import {RowActionItem, RowActions, RowActionSeparator} from '@/components/admin/row-actions';
import {
  AdminListHeader, AdminResultCount, AdminTableCard, AdminToolbarEnd, EntityCell
} from '@/components/admin/list-shell';
import {
  RowCheckbox, SelectAllCheckbox, SelectionBar, useRowSelection
} from '@/components/admin/selection';
import {Avatar, StatusLabel} from '@/components/admin/ui';
import {Link} from '@/i18n/navigation';
import type {ClientRow} from '@/server/clients';
import {archiveClient, archiveClients, restoreClient, restoreClients} from './actions';
import {ClientEditDialog, type EditableClient} from './client-edit-dialog';

export function ClientsTable({
  clients,
  total,
  isAdmin,
  archivedView,
  tabs,
  search,
  pagination
}: {
  clients: ClientRow[];
  /** Rows matching the OPEN tab across all pages — the tab's own number. */
  total: number;
  isAdmin: boolean;
  /** The "Archivés" tab is open: the mass action there is restore, not archive. */
  archivedView: boolean;
  // Server-rendered slots so the card owns the whole surface (orders idiom).
  tabs?: ReactNode;
  search?: ReactNode;
  pagination?: ReactNode;
}) {
  const t = useTranslations('adminClients');
  const tList = useTranslations('admin.list');
  const tSel = useTranslations('admin.selection');
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<EditableClient | null>(null);
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);
  // The only mass action here is archive/restore, which is ADMIN-only, so the
  // whole selection column is absent for a SUB_ADMIN — the server re-checks
  // regardless. Page-scoped: only the ids on this page.
  const selection = useRowSelection(isAdmin ? clients.map((c) => c.id) : []);

  const dateFormatter = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-TN' : 'fr-TN', {
    dateStyle: 'medium'
  });

  function runArchive(id: string) {
    startTransition(async () => {
      const result = await archiveClient(id);
      // Archiving hides a record rather than achieving something — info.
      if (result.ok) toast.info(t('archivedToast'));
      else toast.error(t(`errors.${result.error}` as never));
    });
  }

  function runRestore(id: string) {
    startTransition(async () => {
      const result = await restoreClient(id);
      if (result.ok) toast.success(t('restoredToast'));
      else toast.error(t(`errors.${result.error}` as never));
    });
  }

  function runBulk(
    action: (ids: string[]) => Promise<{ok: boolean; error?: string}>,
    okMessage: string
  ) {
    const ids = selection.ids;
    startTransition(async () => {
      const result = await action(ids);
      if (result.ok) {
        toast.success(okMessage);
        selection.clear();
      } else {
        toast.error(t(`errors.${result.error}` as never));
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <AdminListHeader title={t('title')} />

      <AdminTableCard
        tabs={tabs}
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
              {archivedView ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => runBulk(restoreClients, t('restoredToast'))}
                >
                  {tSel('restore')}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => runBulk(archiveClients, t('archivedToast'))}
                >
                  {tSel('archive')}
                </Button>
              )}
            </SelectionBar>
          ) : (
          <>
            {search}
            <AdminToolbarEnd>
              {/* Counts the OPEN tab, not the whole table. */}
              <AdminResultCount>{tList('results', {count: total})}</AdminResultCount>
            </AdminToolbarEnd>
          </>
          )
        }
        footer={pagination}
      >
        {clients.length === 0 ? (
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
                <TableHead>{t('phone')}</TableHead>
                <TableHead>{t('orders')}</TableHead>
                <TableHead>{t('joined')}</TableHead>
                <TableHead className="text-end">{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => {
                const archived = client.archivedAt !== null;
                return (
                  <TableRow key={client.id} data-selected={selection.has(client.id) || undefined}>
                    {isAdmin && (
                      // aria-label on the CELL: a cell takes its accessible
                      // name from its contents, so an unlabelled one would
                      // announce (and be matched by getByRole('cell', {name}))
                      // as "Sélectionner <nom>", colliding with the name cell
                      // of the very same row. The checkbox keeps its own
                      // precise label.
                      <TableCell className="w-10" aria-label={tSel('column')}>
                        <RowCheckbox
                          selection={selection}
                          id={client.id}
                          label={tSel('selectRow', {name: client.name})}
                        />
                      </TableCell>
                    )}
                    {/* Monogram + name over e-mail — the e-mail keeps its own
                        text node, so nothing that used to be findable is lost. */}
                    <TableCell>
                      <EntityCell
                        media={<Avatar name={client.name} />}
                        primary={
                          <Link
                            href={`/admin/clients/${client.id}`}
                            className="underline-offset-4 hover:underline"
                          >
                            {client.name}
                          </Link>
                        }
                        secondary={client.email}
                        secondaryDir="ltr"
                        badge={
                          archived ? <StatusLabel tone="neutral">{t('archived')}</StatusLabel> : undefined
                        }
                      />
                    </TableCell>
                    <TableCell dir="ltr" className="text-muted-foreground">
                      {client.phone ?? '—'}
                    </TableCell>
                    <TableCell className="tabular-nums">{client._count.orders}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {dateFormatter.format(client.createdAt)}
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t('view')}
                          render={<Link href={`/admin/clients/${client.id}`} />}
                        >
                          <Eye className="size-4" />
                        </Button>
                        {/* Edit is staff-wide; archive/restore is ADMIN-only.
                            An archived row therefore has nothing to offer a
                            SUB_ADMIN (it is view-only, so no edit either) —
                            render no menu rather than an empty one. */}
                        {(isAdmin || !archived) && (
                          <RowActions label={t('actions')} disabled={pending}>
                            {archived ? (
                              <RowActionItem action="restore" onClick={() => runRestore(client.id)}>
                                {t('restore')}
                              </RowActionItem>
                            ) : (
                              <>
                                <RowActionItem
                                  action="edit"
                                  onClick={() =>
                                    setEditing({
                                      id: client.id,
                                      name: client.name,
                                      email: client.email,
                                      phone: client.phone,
                                      address: client.address,
                                      city: client.city
                                    })
                                  }
                                >
                                  {t('edit')}
                                </RowActionItem>
                                {isAdmin && (
                                  <>
                                    <RowActionSeparator />
                                    <RowActionItem
                                      action="archive"
                                      onClick={() => setConfirmArchiveId(client.id)}
                                    >
                                      {t('archive')}
                                    </RowActionItem>
                                  </>
                                )}
                              </>
                            )}
                          </RowActions>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </AdminTableCard>

      {/* The edit dialog follows the edit action: staff-wide. Only the archive
          confirmation stays behind isAdmin. */}
      <ClientEditDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        client={editing}
      />
      {isAdmin && (
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
      )}
    </div>
  );
}
