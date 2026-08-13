import {notFound} from 'next/navigation';
import {getTranslations} from 'next-intl/server';
import {PageHeader, PageTitle} from '@/components/admin/form';
import {StatusLabel} from '@/components/admin/ui';
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
    <div className="flex max-w-4xl flex-col gap-6">
      <PageHeader
        title={<PageTitle>{t('editTitle')}</PageTitle>}
        badges={
          <StatusLabel tone="neutral">
            <span dir="ltr">{product.reference}</span>
          </StatusLabel>
        }
      />
      <ProductForm
        product={product}
        categories={categories}
        readOnly={session.user.role !== 'ADMIN'}
      />
    </div>
  );
}
