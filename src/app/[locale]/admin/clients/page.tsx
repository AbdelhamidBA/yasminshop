import {getTranslations} from 'next-intl/server';

export default async function ClientsPage() {
  const t = await getTranslations('admin.nav');

  return <h1 className="text-2xl font-semibold">{t('clients')}</h1>;
}
