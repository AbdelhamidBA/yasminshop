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
import {Switch} from '@/components/ui/switch';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {Link} from '@/i18n/navigation';
import type {PromoCodeRow} from '@/server/promo-codes';
import {archivePromoCode, restorePromoCode, togglePromoCode} from './actions';
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
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<EditablePromoCode | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);

  const dateFormatter = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-TN' : 'fr-TN', {
    dateStyle: 'medium'
  });

  function runToggle(id: string, active: boolean) {
    startTransition(async () => {
      const result = await togglePromoCode(id, active);
      if (result.ok) toast.success(t(active ? 'toggledOn' : 'toggledOff'));
      else toast.error(t(`errors.${result.error}` as never));
    });
  }

  function runArchive(id: string) {
    startTransition(async () => {
      const result = await archivePromoCode(id);
      if (result.ok) toast.success(t('archivedToast'));
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
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        {isAdmin && (
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" /> {t('add')}
          </Button>
        )}
        <Link
          href={includeArchived ? '/admin/promo-codes' : '/admin/promo-codes?archived=1'}
          className="ms-auto text-sm underline-offset-4 hover:underline"
        >
          {t('showArchived')}
        </Link>
      </div>

      {promoCodes.length === 0 ? (
        <p className="text-muted-foreground">{t('empty')}</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
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
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      <span dir="ltr" className="font-mono">{row.code}</span>
                      {archived && <Badge variant="outline" className="ms-2">{t('archived')}</Badge>}
                    </TableCell>
                    <TableCell dir="ltr">-{row.percentOff}%</TableCell>
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
                    <TableCell>
                      {row.expiresAt ? dateFormatter.format(row.expiresAt) : t('noExpiry')}
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
                            <DropdownMenuItem
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
                            </DropdownMenuItem>
                            {archived ? (
                              <DropdownMenuItem onClick={() => runRestore(row.id)}>
                                {t('restore')}
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => setConfirmArchiveId(row.id)}>
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
