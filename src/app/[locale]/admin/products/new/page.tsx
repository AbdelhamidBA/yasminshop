import {getLocale, getTranslations} from 'next-intl/server';
import {PageHeader, PageTitle} from '@/components/admin/form';
import {redirect} from '@/i18n/navigation';
import {requirePageStaff} from '@/server/authz';
import {listCategoryTree} from '@/server/categories';
import {getParameters} from '@/server/settings';
import {ProductForm} from '../product-form';

export default async function NewProductPage() {
  const session = await requirePageStaff();
  if (session.user.role !== 'ADMIN') {
    redirect({href: '/admin/products', locale: await getLocale()});
  }
  const t = await getTranslations('admin.productForm');
  const [categories, parameters] = await Promise.all([listCategoryTree(), getParameters()]);

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      {/* The form's own Cancel link is the way back to the list — no duplicate
          back affordance in the header. */}
      <PageHeader title={<PageTitle>{t('createTitle')}</PageTitle>} />
      <ProductForm
        product={null}
        categories={categories}
        readOnly={false}
        defaultWholesaleMinQty={parameters.wholesaleMinQty}
      />
    </div>
  );
}
