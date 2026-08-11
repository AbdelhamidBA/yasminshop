import {notFound} from 'next/navigation';
import {getTranslations} from 'next-intl/server';
import {requirePageStaff} from '@/server/authz';
import {listCategoryTree} from '@/server/categories';
import {getProduct} from '@/server/products';
import {ProductForm} from '../../product-form';

export default async function EditProductPage({
  params
}: {
  params: Promise<{id: string}>;
}) {
  const session = await requirePageStaff();
  const {id} = await params;
  const t = await getTranslations('admin.productForm');
  const [product, categories] = await Promise.all([getProduct(id), listCategoryTree()]);
  if (!product) notFound();

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t('editTitle')}</h1>
      <ProductForm
        product={product}
        categories={categories}
        readOnly={session.user.role !== 'ADMIN'}
      />
    </div>
  );
}
