'use client';

import {useState, useTransition} from 'react';
import {Eye, MoreHorizontal} from 'lucide-react';
import {useSearchParams} from 'next/navigation';
import {useLocale, useTranslations} from 'next-intl';
import {toast} from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {OrderStatusBadge} from '@/components/admin/order-status-badge';
import {Link} from '@/i18n/navigation';
import {formatMillimes} from '@/lib/money';
import type {OrderRow} from '@/server/orders';
import {archiveOrder, restoreOrder} from './actions';

export function OrdersTable({
  orders,
  isAdmin,
  includeArchived,
  currencyLabel
}: {
  orders: OrderRow[];
  isAdmin: boolean;
  includeArchived: boolean;
  currencyLabel: string;
}) {
  const t = useTranslations('adminOrders');
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
      if (result.ok) toast.success(t('archivedToast'));
      else toast.error(t(`errors.${result.error}` as never));
    });
  }

  function runRestore(id: string) {
    startTransition(async () => {
      const result = await restoreOrder(id);
      if (result.ok) toast.success(t('restoredToast'));
      else toast.error(t(`errors.${result.error}` as never));
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center">
        <Link href={toggleHref} className="ms-auto text-sm underline-offset-4 hover:underline">
          {t('showArchived')}
        </Link>
      </div>

      {orders.length === 0 ? (
        <p className="text-muted-foreground">{t('empty')}</p>
      ) : (
        <div className="rounded-md border">
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
                    <TableCell className="font-medium">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        dir="ltr"
                        className="underline-offset-4 hover:underline"
                      >
                        #{order.number}
                      </Link>
                      {archived && (
                        <Badge variant="outline" className="ms-2">{t('archived')}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{order.customerName}</div>
                      <div dir="ltr" className="text-xs text-muted-foreground">
                        {order.customerPhone}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {dateFormatter.format(order.createdAt)}
                    </TableCell>
                    <TableCell>{order._count.items}</TableCell>
                    <TableCell className="tabular-nums">
                      {formatMillimes(order.totalMillimes)} {currencyLabel}
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
        </div>
      )}

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
