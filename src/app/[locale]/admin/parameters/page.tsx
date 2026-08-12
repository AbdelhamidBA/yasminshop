import {getTranslations} from 'next-intl/server';
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
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      {!isAdmin && <p className="text-sm text-muted-foreground">{t('readOnly')}</p>}
      <ParametersForm parameters={parameters} readOnly={!isAdmin} />
      {isAdmin && <MassDiscountControl currentPct={massDiscountPct} />}
    </div>
  );
}
