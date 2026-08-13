'use client';

import {useState} from 'react';
import {Pencil} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {Button} from '@/components/ui/button';
import {useRouter} from '@/i18n/navigation';
import {ClientEditDialog, type EditableClient} from '../client-edit-dialog';

/**
 * "Modifier" on the client profile page — the same dialog and the same
 * updateClient action the list row opens, reachable from the record itself so
 * an operator who navigated in from an order does not have to go back to the
 * list to fix a phone number.
 *
 * Staff-wide (ADMIN + SUB_ADMIN), matching updateClient's requireStaff. The
 * page renders it only while the client is live: archived clients are
 * view-only, and the action would refuse with `clientArchived` anyway.
 *
 * Pencil is the shared edit glyph (row-actions.tsx ROW_ACTION_ICONS), so the
 * affordance reads the same here as in the row menu.
 */
export function ClientProfileActions({client}: {client: EditableClient}) {
  const t = useTranslations('adminClients');
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        className="h-10 bg-(--admin-neutral-soft) px-4"
        onClick={() => setEditing(true)}
      >
        <Pencil aria-hidden="true" className="size-4" /> {t('edit')}
      </Button>
      {/* updateClient revalidates the LIST route, not this one — refresh so the
          profile card shows what was just saved (OrderAdminActions idiom). */}
      <ClientEditDialog
        open={editing}
        onOpenChange={setEditing}
        client={client}
        onSaved={() => router.refresh()}
      />
    </>
  );
}
