import {getTranslations} from 'next-intl/server';
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
  const t = await getTranslations('admin.promoCodesPage');
  const promoCodes = await listPromoCodes(includeArchived);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <PromoCodesTable
        promoCodes={promoCodes}
        isAdmin={session.user.role === 'ADMIN'}
        includeArchived={includeArchived}
      />
    </div>
  );
}
