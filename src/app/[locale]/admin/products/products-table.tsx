'use client';

import {type ReactNode, useState, useTransition} from 'react';
import {Check, Plus} from 'lucide-react';
import {useSearchParams} from 'next/navigation';
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
import {StatusLabel} from '@/components/admin/ui';
import {Link} from '@/i18n/navigation';
import {effectivePriceMillimes, formatMillimes} from '@/lib/money';
import type {ProductRow} from '@/server/products';
import {
  archiveProduct, archiveProducts, deleteProducts, restoreProduct, restoreProducts
} from './actions';
import {QuantityCell} from './quantity-cell';

export function ProductsTable({
  products,
  total,
  isAdmin,
  includeArchived,
  lowStockThreshold,
  currencyLabel,
  search,
  pagination
}: {
  products: ProductRow[];
  /** Rows matching the current filters across ALL pages, not just this one. */
  total: number;
  isAdmin: boolean;
  includeArchived: boolean;
  lowStockThreshold: number;
  currencyLabel: string;
  // Server-rendered slots so the card owns the whole surface (orders idiom).
  search?: ReactNode;
  pagination?: ReactNode;
}) {
  const t = useTranslations('admin.products');
  const tList = useTranslations('admin.list');
  const locale = useLocale();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const tSel = useTranslations('admin.selection');
  // Mass actions are ADMIN-only (a SUB_ADMIN may edit quantity and nothing
  // else), so the whole selection column is absent for them — the server
  // re-checks regardless.
  const selection = useRowSelection(isAdmin ? products.map((p) => p.id) : []);

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

  const name = (row: {nameFr: string; nameAr: string}) => (locale === 'ar' ? row.nameAr : row.nameFr);

  const toggleParams = new URLSearchParams();
  const q = searchParams.get('q');
  if (q) toggleParams.set('q', q);
  if (!includeArchived) toggleParams.set('archived', '1');
  const toggleHref = `/admin/products${toggleParams.size ? `?${toggleParams}` : ''}`;

  function runArchive(id: string) {
    startTransition(async () => {
      const result = await archiveProduct(id);
      // Archiving hides a record rather than achieving something — info.
      if (result.ok) toast.info(t('archivedToast'));
      else toast.error(t(`errors.${result.error}` as never));
    });
  }

  function runRestore(id: string) {
    startTransition(async () => {
      const result = await restoreProduct(id);
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
            <Button render={<Link href="/admin/products/new" />}>
              <Plus className="size-4" /> {t('add')}
            </Button>
          ) : undefined
        }
      />

      <AdminTableCard
        footer={pagination}
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
                  onClick={() => runBulk(restoreProducts, t('bulkRestoredToast'))}
                >
                  {tSel('restore')}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => runBulk(archiveProducts, t('bulkArchivedToast'))}
                >
                  {tSel('archive')}
                </Button>
              )}
              <Button
                variant="destructive"
                size="sm"
                disabled={pending}
                onClick={() => setConfirmDelete(true)}
              >
                {tSel('delete')}
              </Button>
            </SelectionBar>
          ) : (
          <>
            {/* The search field is created by the server page and handed down;
                wrapping it here keeps it out of a bare array slot (React key
                warning) and lets it take the free space in the toolbar row. */}
            <div className="min-w-0 flex-1">{search}</div>
            <AdminToolbarEnd>
              <AdminResultCount>{tList('results', {count: total})}</AdminResultCount>
              <AdminFilterToggle href={toggleHref} active={includeArchived}>
                {t('showArchived')}
              </AdminFilterToggle>
            </AdminToolbarEnd>
          </>
          )
        }
      >
        {products.length === 0 ? (
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
                <TableHead>{t('category')}</TableHead>
                <TableHead>{t('price')}</TableHead>
                <TableHead>{t('quantity')}</TableHead>
                <TableHead>{t('featured')}</TableHead>
                {isAdmin && <TableHead className="text-end">{t('actions')}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => {
                const archived = product.archivedAt !== null;
                const discounted = product.discountPct > 0;
                return (
                  <TableRow key={product.id} data-selected={selection.has(product.id) || undefined}>
                    {isAdmin && (
                      // Labelled so the cell does not inherit its accessible
                      // name from the checkbox inside it: an unlabelled
                      // selection cell announces as "Selectionner <name>" and
                      // collides with the row's own name cell in cell lookups.
                      <TableCell className="w-10" aria-label={tSel('column')}>
                        <RowCheckbox
                          selection={selection}
                          id={product.id}
                          label={tSel('selectRow', {name: name(product)})}
                        />
                      </TableCell>
                    )}
                    {/* Thumbnail + name over reference: the reference keeps its own
                        text node, so a row's accessible name still contains it. */}
                    <TableCell>
                      <EntityCell
                        media={
                          <img
                            src={product.images[0]?.url}
                            alt=""
                            className="size-10 shrink-0 rounded-lg bg-muted object-cover"
                          />
                        }
                        primary={name(product)}
                        // Reference keeps its own LTR text node (a row's
                        // accessible name must still contain it); the brand
                        // follows the page direction and is simply absent when
                        // the product has none.
                        secondary={
                          <span className="flex flex-wrap items-center gap-x-1.5">
                            <span dir="ltr">{product.reference}</span>
                            {product.brand ? (
                              <>
                                <span aria-hidden="true" className="opacity-40">
                                  ·
                                </span>
                                <span className="font-semibold">{product.brand}</span>
                              </>
                            ) : null}
                          </span>
                        }
                        badge={
                          archived ? <StatusLabel tone="neutral">{t('archived')}</StatusLabel> : undefined
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{name(product.category)}</div>
                      {product.subCategory ? (
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {name(product.subCategory)}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {discounted && (
                          <span className="text-xs text-muted-foreground line-through">
                            {formatMillimes(product.priceMillimes)}
                          </span>
                        )}
                        <span className="text-sm font-semibold tabular-nums">
                          {formatMillimes(
                            discounted
                              ? effectivePriceMillimes(product.priceMillimes, product.discountPct, null)
                              : product.priceMillimes
                          )}{' '}
                          {currencyLabel}
                        </span>
                        {discounted && (
                          <StatusLabel tone="primary">-{product.discountPct}%</StatusLabel>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <QuantityCell
                          key={`${product.id}:${product.quantity}`}
                          productId={product.id}
                          quantity={product.quantity}
                        />
                        {product.quantity === 0 ? (
                          <StatusLabel tone="error">{t('outOfStock')}</StatusLabel>
                        ) : (
                          product.quantity <= lowStockThreshold && (
                            <StatusLabel tone="warning">{t('lowStock')}</StatusLabel>
                          )
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {product.featured ? (
                        <Check className="size-4 text-(--admin-success)" />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-end">
                        <RowActions label={t('actions')} disabled={pending}>
                          <RowActionItem
                            action="edit"
                            render={<Link href={`/admin/products/${product.id}/edit`} />}
                          >
                            {t('edit')}
                          </RowActionItem>
                          <RowActionSeparator />
                          {archived ? (
                            <RowActionItem action="restore" onClick={() => runRestore(product.id)}>
                              {t('restore')}
                            </RowActionItem>
                          ) : (
                            <RowActionItem
                              action="archive"
                              onClick={() => setConfirmArchiveId(product.id)}
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
      )}

      {/* Permanent delete — the only irreversible action in the admin, so it
          always confirms and always names the count. The server refuses the
          batch outright if any product has ever been ordered. */}
      {isAdmin && (
        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('deleteTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('deleteBody', {count: selection.count})}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  runBulk(deleteProducts, t('deletedToast'), t('deletedDescription'));
                  setConfirmDelete(false);
                }}
              >
                {tSel('delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
