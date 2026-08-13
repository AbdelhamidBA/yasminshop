'use client';

import {type ReactNode, useState, useTransition} from 'react';
import {Check, MoreHorizontal, Plus} from 'lucide-react';
import {useSearchParams} from 'next/navigation';
import {useLocale, useTranslations} from 'next-intl';
import {toast} from 'sonner';
import {Button} from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
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
import {StatusLabel} from '@/components/admin/ui';
import {Link} from '@/i18n/navigation';
import {effectivePriceMillimes, formatMillimes} from '@/lib/money';
import type {ProductRow} from '@/server/products';
import {archiveProduct, restoreProduct} from './actions';
import {QuantityCell} from './quantity-cell';

export function ProductsTable({
  products,
  isAdmin,
  includeArchived,
  lowStockThreshold,
  currencyLabel,
  search
}: {
  products: ProductRow[];
  isAdmin: boolean;
  includeArchived: boolean;
  lowStockThreshold: number;
  currencyLabel: string;
  search?: ReactNode;
}) {
  const t = useTranslations('admin.products');
  const tList = useTranslations('admin.list');
  const locale = useLocale();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);

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
        toolbar={
          <>
            {/* The search field is created by the server page and handed down;
                wrapping it here keeps it out of a bare array slot (React key
                warning) and lets it take the free space in the toolbar row. */}
            <div className="min-w-0 flex-1">{search}</div>
            <AdminToolbarEnd>
              <AdminResultCount>{tList('results', {count: products.length})}</AdminResultCount>
              <AdminFilterToggle href={toggleHref} active={includeArchived}>
                {t('showArchived')}
              </AdminFilterToggle>
            </AdminToolbarEnd>
          </>
        }
      >
        {products.length === 0 ? (
          <AdminEmptyState>{t('empty')}</AdminEmptyState>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
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
                  <TableRow key={product.id}>
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
                        secondary={product.reference}
                        secondaryDir="ltr"
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
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button variant="ghost" size="icon" aria-label={t('actions')} disabled={pending}>
                                <MoreHorizontal className="size-4" />
                              </Button>
                            }
                          />
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem render={<Link href={`/admin/products/${product.id}/edit`} />}>
                              {t('edit')}
                            </DropdownMenuItem>
                            {archived ? (
                              <DropdownMenuItem onClick={() => runRestore(product.id)}>
                                {t('restore')}
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => setConfirmArchiveId(product.id)}>
                                {t('archive')}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
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
    </div>
  );
}
