'use client';

import {useState, useTransition} from 'react';
import {MoreHorizontal, Plus} from 'lucide-react';
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
import {Link} from '@/i18n/navigation';
import type {CategoryRow} from '@/server/categories';
import {archiveCategory, restoreCategory} from './actions';
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
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<EditableCategory | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);

  const name = (row: {nameFr: string; nameAr: string}) => (locale === 'ar' ? row.nameAr : row.nameFr);

  function runArchive(id: string) {
    startTransition(async () => {
      const result = await archiveCategory(id);
      if (result.ok) toast.success(t('archivedToast'));
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
      <TableRow key={row.id}>
        <TableCell className={isChild ? 'ps-8' : 'font-medium'}>
          {name(row)}
          {archived && <Badge variant="outline" className="ms-2">{t('archived')}</Badge>}
        </TableCell>
        <TableCell dir="ltr" className="text-muted-foreground">{row.slug}</TableCell>
        <TableCell>{row._count.products}</TableCell>
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
                <DropdownMenuItem
                  onSelect={() =>
                    setEditing({
                      id: row.id,
                      nameFr: row.nameFr,
                      nameAr: row.nameAr,
                      parentId: 'parentId' in row ? row.parentId : null
                    })
                  }
                >
                  {t('edit')}
                </DropdownMenuItem>
                {archived ? (
                  <DropdownMenuItem onSelect={() => runRestore(row.id)}>{t('restore')}</DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onSelect={() => setConfirmArchiveId(row.id)}>{t('archive')}</DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </TableCell>
        )}
      </TableRow>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        {isAdmin && (
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" /> {t('add')}
          </Button>
        )}
        <Link
          href={includeArchived ? '/admin/categories' : '/admin/categories?archived=1'}
          className="ms-auto text-sm underline-offset-4 hover:underline"
        >
          {t('showArchived')}
        </Link>
      </div>

      {categories.length === 0 ? (
        <p className="text-muted-foreground">{t('empty')}</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('title')}</TableHead>
                <TableHead>{t('slug')}</TableHead>
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
        </div>
      )}

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
