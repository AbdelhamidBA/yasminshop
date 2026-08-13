import {getTranslations} from 'next-intl/server';
import {PageHeader, PageTitle, SoftNote} from '@/components/admin/form';
import {requirePageStaff} from '@/server/authz';
import {getMassDiscountPct, getParameters} from '@/server/settings';
import {MassDiscountControl} from './mass-discount-control';
import {ParametersForm} from './parameters-form';

export default async function ParametersPage() {
  const session = await requirePageStaff();
  const t = await getTranslations('admin.parameters');
  const [parameters, massDiscountPct] = await Promise.all([getParameters(), getMassDiscountPct()]);
  const isAdmin = session.user.role === 'ADMIN';

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <PageHeader title={<PageTitle>{t('title')}</PageTitle>} />
      {!isAdmin && <SoftNote>{t('readOnly')}</SoftNote>}
      <ParametersForm parameters={parameters} readOnly={!isAdmin} />
      {isAdmin && <MassDiscountControl currentPct={massDiscountPct} />}
    </div>
  );
}
