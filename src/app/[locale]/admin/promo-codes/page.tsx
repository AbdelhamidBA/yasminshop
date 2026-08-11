import {getTranslations} from 'next-intl/server';

export default async function PromoCodesPage() {
  const t = await getTranslations('admin.nav');

  return <h1 className="text-2xl font-semibold">{t('promoCodes')}</h1>;
}
