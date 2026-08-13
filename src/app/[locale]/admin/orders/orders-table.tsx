'use client';

import {type ReactNode, useState, useTransition} from 'react';
import {Eye, MoreHorizontal, Plus} from 'lucide-react';
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
import {OrderStatusBadge} from '@/components/admin/order-status-badge';
import {Avatar, StatusLabel} from '@/components/admin/ui';
import {Link} from '@/i18n/navigation';
import {formatMillimes} from '@/lib/money';
import type {OrderRow} from '@/server/orders';
import {archiveOrder, restoreOrder} from './actions';

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
  const locale = useLocale();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);

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
          <>
            {search}
            <AdminToolbarEnd>
              <AdminResultCount>{tList('results', {count: total})}</AdminResultCount>
              <AdminFilterToggle href={toggleHref} active={includeArchived}>
                {t('showArchived')}
              </AdminFilterToggle>
            </AdminToolbarEnd>
          </>
        }
        footer={pagination}
      >
        {orders.length === 0 ? (
          <AdminEmptyState>{t('empty')}</AdminEmptyState>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
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
                  <TableRow key={order.id}>
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
                                <DropdownMenuItem onClick={() => runRestore(order.id)}>
                                  {t('restore')}
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => setConfirmArchiveId(order.id)}>
                                  {t('archive')}
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
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
