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
import {Link} from '@/i18n/navigation';
import type {ClientRow} from '@/server/clients';
import {archiveClient, restoreClient} from './actions';
import {ClientEditDialog, type EditableClient} from './client-edit-dialog';

export function ClientsTable({
  clients,
  isAdmin,
  includeArchived
}: {
  clients: ClientRow[];
  isAdmin: boolean;
  includeArchived: boolean;
}) {
  const t = useTranslations('adminClients');
  const locale = useLocale();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<EditableClient | null>(null);
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);

  const dateFormatter = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-TN' : 'fr-TN', {
    dateStyle: 'medium'
  });

  // Archived-toggle link preserves the search (orders-table idiom).
  const toggleParams = new URLSearchParams();
  const q = searchParams.get('q');
  if (q) toggleParams.set('q', q);
  if (!includeArchived) toggleParams.set('archived', '1');
  const toggleHref = `/admin/clients${toggleParams.size ? `?${toggleParams}` : ''}`;

  function runArchive(id: string) {
    startTransition(async () => {
      const result = await archiveClient(id);
      if (result.ok) toast.success(t('archivedToast'));
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href={toggleHref} className="ms-auto text-sm underline-offset-4 hover:underline">
          {t('showArchived')}
        </Link>
      </div>

      {clients.length === 0 ? (
        <p className="text-muted-foreground">{t('empty')}</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('name')}</TableHead>
                <TableHead>{t('email')}</TableHead>
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
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/admin/clients/${client.id}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {client.name}
                      </Link>
                      {archived && (
                        <Badge variant="outline" className="ms-2">{t('archived')}</Badge>
                      )}
                    </TableCell>
                    <TableCell dir="ltr" className="text-muted-foreground">
                      {client.email}
                    </TableCell>
                    <TableCell dir="ltr" className="text-muted-foreground">
                      {client.phone ?? '—'}
                    </TableCell>
                    <TableCell>{client._count.orders}</TableCell>
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
                                <DropdownMenuItem onClick={() => runRestore(client.id)}>
                                  {t('restore')}
                                </DropdownMenuItem>
                              ) : (
                                <>
                                  <DropdownMenuItem
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
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setConfirmArchiveId(client.id)}>
                                    {t('archive')}
                                  </DropdownMenuItem>
                                </>
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
        <>
          <ClientEditDialog
            open={editing !== null}
            onOpenChange={(open) => !open && setEditing(null)}
            client={editing}
          />
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
        </>
      )}
    </div>
  );
}
