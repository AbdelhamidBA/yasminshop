'use client';

import {type ReactNode, useState, useTransition} from 'react';
import {Eye, Plus} from 'lucide-react';
import {useSearchParams} from 'next/navigation';
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
import {RowActionItem, RowActions} from '@/components/admin/row-actions';
import {
  AdminFilterToggle, AdminListHeader, AdminResultCount, AdminTableCard, AdminToolbarEnd,
  EntityCell
} from '@/components/admin/list-shell';
import {OrderStatusBadge} from '@/components/admin/order-status-badge';
import {
  RowCheckbox, SelectAllCheckbox, SelectionBar, useRowSelection
} from '@/components/admin/selection';
import {Avatar, StatusLabel} from '@/components/admin/ui';
import {Link} from '@/i18n/navigation';
import {formatMillimes} from '@/lib/money';
import type {OrderRow} from '@/server/orders';
import {archiveOrder, archiveOrders, restoreOrder, restoreOrders} from './actions';

export function OrdersTable({
  orders,
  total,
  isAdmin,
  includeArchived,
  currencyLabel,
  tabs,
  search,
  pagination
}: {
  orders: OrderRow[];
  total: number;
  isAdmin: boolean;
  includeArchived: boolean;
  currencyLabel: string;
  // Server-rendered slots so the card owns the whole surface: the status tabs,
  // the search field and the pagination all render inside it.
  tabs?: ReactNode;
  search?: ReactNode;
  pagination?: ReactNode;
}) {
  const t = useTranslations('adminOrders');
  const tList = useTranslations('admin.list');
  const tSel = useTranslations('admin.selection');
  const locale = useLocale();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);
  // Mass actions are ADMIN-only (a SUB_ADMIN may change an order's status and
  // nothing else), so the whole selection column is absent for them — the
  // server re-checks regardless. Page-scoped: only the ids on this page.
  const selection = useRowSelection(isAdmin ? orders.map((o) => o.id) : []);

  const dateFormatter = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-TN' : 'fr-TN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  // Archived-toggle link preserves the search and the active status tab
  // (products-table idiom).
  const toggleParams = new URLSearchParams();
  const q = searchParams.get('q');
  const status = searchParams.get('status');
  if (q) toggleParams.set('q', q);
  if (status) toggleParams.set('status', status);
  if (!includeArchived) toggleParams.set('archived', '1');
  const toggleHref = `/admin/orders${toggleParams.size ? `?${toggleParams}` : ''}`;

  function runArchive(id: string) {
    startTransition(async () => {
      const result = await archiveOrder(id);
      // Archiving hides a record rather than achieving something — info.
      if (result.ok) toast.info(t('archivedToast'), {description: t('archivedDescription')});
      else toast.error(t(`errors.${result.error}` as never));
    });
  }

  function runRestore(id: string) {
    startTransition(async () => {
      const result = await restoreOrder(id);
      if (result.ok) toast.success(t('restoredToast'), {description: t('restoredDescription')});
      else toast.error(t(`errors.${result.error}` as never));
    });
  }

  function runBulk(
    action: (ids: string[]) => Promise<{ok: boolean; error?: string}>,
    okMessage: string,
    okDescription?: string
  ) {
    const ids = selection.ids;
    startTransition(async () => {
      const result = await action(ids);
      if (result.ok) {
        toast.success(okMessage, okDescription ? {description: okDescription} : undefined);
        selection.clear();
      } else {
        toast.error(t(`errors.${result.error}` as never));
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <AdminListHeader
        title={t('title')}
        action={
          isAdmin ? (
            <Button render={<Link href="/admin/orders/new" />}>
              <Plus className="size-4" /> {t('new.button')}
            </Button>
          ) : undefined
        }
      />

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
              {includeArchived ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    runBulk(restoreOrders, t('restoredToast'), t('restoredDescription'))
                  }
                >
                  {tSel('restore')}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => runBulk(archiveOrders, t('archivedToast'), t('archivedDescription'))}
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
        {orders.length === 0 ? (
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
                <TableHead>{t('number')}</TableHead>
                <TableHead>{t('customer')}</TableHead>
                <TableHead>{t('date')}</TableHead>
                <TableHead>{t('items')}</TableHead>
                <TableHead>{t('total')}</TableHead>
                <TableHead>{t('statusHeader')}</TableHead>
                <TableHead className="text-end">{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => {
                const archived = order.archivedAt !== null;
                return (
                  <TableRow key={order.id} data-selected={selection.has(order.id) || undefined}>
                    {isAdmin && (
                      // aria-label on the CELL: a cell takes its accessible
                      // name from its contents, so an unlabelled one would
                      // announce (and be matched by getByRole('cell', {name}))
                      // as "Sélectionner #227", colliding with the number cell
                      // of the very same row. The checkbox keeps its own
                      // precise label.
                      <TableCell className="w-10" aria-label={tSel('column')}>
                        <RowCheckbox
                          selection={selection}
                          id={order.id}
                          label={tSel('selectRow', {name: `#${order.number}`})}
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          dir="ltr"
                          className="text-sm font-semibold underline-offset-4 hover:underline"
                        >
                          #{order.number}
                        </Link>
                        {archived && <StatusLabel tone="neutral">{t('archived')}</StatusLabel>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <EntityCell
                        media={<Avatar name={order.customerName} />}
                        primary={order.customerName}
                        secondary={order.customerPhone}
                        secondaryDir="ltr"
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {dateFormatter.format(order.createdAt)}
                    </TableCell>
                    <TableCell className="tabular-nums">{order._count.items}</TableCell>
                    <TableCell>
                      <span className="text-sm font-semibold tabular-nums">
                        {formatMillimes(order.totalMillimes)} {currencyLabel}
                      </span>
                    </TableCell>
                    <TableCell>
                      <OrderStatusBadge status={order.status} />
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t('view')}
                          render={<Link href={`/admin/orders/${order.id}`} />}
                        >
                          <Eye className="size-4" />
                        </Button>
                        {isAdmin && (
                          <RowActions label={t('actions')} disabled={pending}>
                            {archived ? (
                              <RowActionItem action="restore" onClick={() => runRestore(order.id)}>
                                {t('restore')}
                              </RowActionItem>
                            ) : (
                              <RowActionItem
                                action="archive"
                                onClick={() => setConfirmArchiveId(order.id)}
                              >
                                {t('archive')}
                              </RowActionItem>
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
