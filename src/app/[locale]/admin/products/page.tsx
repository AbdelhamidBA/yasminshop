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
  const [products, parameters] = await Promise.all([
    listProducts({search: q?.trim() || undefined, includeArchived}),
    getParameters()
  ]);

  return (
    <ProductsTable
      products={products}
      isAdmin={session.user.role === 'ADMIN'}
      includeArchived={includeArchived}
      lowStockThreshold={parameters.lastChanceThreshold}
      currencyLabel={parameters.currency}
      search={<SearchInput initialValue={q ?? ''} includeArchived={includeArchived} />}
    />
  );
}
