import {getTranslations} from 'next-intl/server';

export default async function ProductsPage() {
  const t = await getTranslations('admin.nav');

  return <h1 className="text-2xl font-semibold">{t('products')}</h1>;
}
