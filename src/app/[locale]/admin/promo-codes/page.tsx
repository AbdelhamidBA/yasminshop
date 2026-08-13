import {requirePageStaff} from '@/server/authz';
import {listPromoCodes} from '@/server/promo-codes';
import {PromoCodesTable} from './promo-codes-table';

export default async function PromoCodesPage({
  searchParams
}: {
  searchParams: Promise<{archived?: string}>;
}) {
  const session = await requirePageStaff();
  const {archived} = await searchParams;
  const includeArchived = archived === '1';
  const promoCodes = await listPromoCodes(includeArchived);

  return (
    <PromoCodesTable
      promoCodes={promoCodes}
      isAdmin={session.user.role === 'ADMIN'}
      includeArchived={includeArchived}
    />
  );
}
