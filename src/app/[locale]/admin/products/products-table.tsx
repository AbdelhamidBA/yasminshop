'use client';

import {useState, useTransition} from 'react';
import {Check, MoreHorizontal, Plus} from 'lucide-react';
import {useSearchParams} from 'next/navigation';
import {useLocale, useTranslations} from 'next-intl';
import {toast} from 'sonner';
import {Badge} from '@/components/ui/badge';
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
  currencyLabel
}: {
  products: ProductRow[];
  isAdmin: boolean;
  includeArchived: boolean;
  lowStockThreshold: number;
  currencyLabel: string;
}) {
  const t = useTranslations('admin.products');
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
      if (result.ok) toast.success(t('archivedToast'));
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
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        {isAdmin && (
          <Button render={<Link href="/admin/products/new" />}>
            <Plus className="size-4" /> {t('add')}
          </Button>
        )}
        <Link href={toggleHref} className="ms-auto text-sm underline-offset-4 hover:underline">
          {t('showArchived')}
        </Link>
      </div>

      {products.length === 0 ? (
        <AdminEmptyState>{t('empty')}</AdminEmptyState>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14" />
                <TableHead>{t('reference')}</TableHead>
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
                    <TableCell>
                      <img
                        src={product.images[0]?.url}
                        alt=""
                        className="size-10 rounded-md object-cover"
                      />
                    </TableCell>
                    <TableCell dir="ltr" className="text-muted-foreground">
                      {product.reference}
                    </TableCell>
                    <TableCell className="font-medium">
                      {name(product)}
                      {archived && <Badge variant="outline" className="ms-2">{t('archived')}</Badge>}
                    </TableCell>
                    <TableCell>
                      {name(product.category)}
                      {product.subCategory ? ` / ${name(product.subCategory)}` : ''}
                    </TableCell>
                    <TableCell>
                      {discounted && (
                        <span className="line-through text-muted-foreground me-2">
                          {formatMillimes(product.priceMillimes)}
                        </span>
                      )}
                      {formatMillimes(
                        discounted
                          ? effectivePriceMillimes(product.priceMillimes, product.discountPct, null)
                          : product.priceMillimes
                      )}{' '}
                      {currencyLabel}
                      {discounted && (
                        <Badge className="ms-2">-{product.discountPct}%</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <QuantityCell
                          key={`${product.id}:${product.quantity}`}
                          productId={product.id}
                          quantity={product.quantity}
                        />
                        {product.quantity === 0 ? (
                          <Badge variant="destructive">{t('outOfStock')}</Badge>
                        ) : (
                          product.quantity <= lowStockThreshold && (
                            <Badge variant="outline">{t('lowStock')}</Badge>
                          )
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {product.featured ? <Check className="size-4" /> : '—'}
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
        </div>
      )}

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
