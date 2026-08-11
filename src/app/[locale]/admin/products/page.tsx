import {getTranslations} from 'next-intl/server';
import {requirePageStaff} from '@/server/authz';
import {listProducts} from '@/server/products';
import {getParameters} from '@/server/settings';
import {ProductsTable} from './products-table';
import {SearchInput} from './search-input';

export default async function ProductsPage({
  searchParams
}: {
  searchParams: Promise<{q?: string; archived?: string}>;
}) {
  const session = await requirePageStaff();
  const {q, archived} = await searchParams;
  const includeArchived = archived === '1';
  const t = await getTranslations('admin.products');
  const [products, parameters] = await Promise.all([
    listProducts({search: q?.trim() || undefined, includeArchived}),
    getParameters()
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <SearchInput initialValue={q ?? ''} includeArchived={includeArchived} />
      <ProductsTable
        products={products}
        isAdmin={session.user.role === 'ADMIN'}
        includeArchived={includeArchived}
        lowStockThreshold={parameters.lastChanceThreshold}
        currencyLabel={parameters.currency}
      />
    </div>
  );
}
