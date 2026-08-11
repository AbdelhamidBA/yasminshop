import {getTranslations} from 'next-intl/server';
import {requirePageStaff} from '@/server/authz';
import {getParameters} from '@/server/settings';
import {ParametersForm} from './parameters-form';

export default async function ParametersPage() {
  const session = await requirePageStaff();
  const t = await getTranslations('admin.parameters');
  const parameters = await getParameters();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      {session.user.role !== 'ADMIN' && (
        <p className="text-sm text-muted-foreground">{t('readOnly')}</p>
      )}
      <ParametersForm parameters={parameters} readOnly={session.user.role !== 'ADMIN'} />
    </div>
  );
}
