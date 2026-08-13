'use client';

import {useState, useTransition} from 'react';
import {MoreHorizontal, Plus, Ticket} from 'lucide-react';
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
import {Switch} from '@/components/ui/switch';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {AdminEmptyState} from '@/components/admin/empty-state';
import {
  AdminFilterToggle, AdminListHeader, AdminResultCount, AdminTableCard, AdminToolbarEnd,
  EntityCell
} from '@/components/admin/list-shell';
import {IconBox, StatusLabel} from '@/components/admin/ui';
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
  const tList = useTranslations('admin.list');
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
          <AdminToolbarEnd>
            <AdminResultCount>{tList('results', {count: promoCodes.length})}</AdminResultCount>
            <AdminFilterToggle
              href={includeArchived ? '/admin/promo-codes' : '/admin/promo-codes?archived=1'}
              active={includeArchived}
            >
              {t('showArchived')}
            </AdminFilterToggle>
          </AdminToolbarEnd>
        }
      >
        {promoCodes.length === 0 ? (
          <AdminEmptyState>{t('empty')}</AdminEmptyState>
        ) : (
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
