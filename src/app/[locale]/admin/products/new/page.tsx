import {getLocale, getTranslations} from 'next-intl/server';
import {redirect} from '@/i18n/navigation';
import {requirePageStaff} from '@/server/authz';
import {listCategoryTree} from '@/server/categories';
import {ProductForm} from '../product-form';

export default async function NewProductPage() {
  const session = await requirePageStaff();
  if (session.user.role !== 'ADMIN') {
    redirect({href: '/admin/products', locale: await getLocale()});
  }
  const t = await getTranslations('admin.productForm');
  const categories = await listCategoryTree();

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t('createTitle')}</h1>
      <ProductForm product={null} categories={categories} readOnly={false} />
    </div>
  );
}
