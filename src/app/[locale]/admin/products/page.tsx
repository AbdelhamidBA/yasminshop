import {getTranslations} from 'next-intl/server';
import {AdminPagination} from '@/components/admin/admin-pagination';
import {pageRange, parsePage, parsePageSize, totalPages} from '@/lib/pagination';
import {requirePageStaff} from '@/server/authz';
import {getProductStats, listProducts} from '@/server/products';
import {getParameters} from '@/server/settings';
import {ProductStats} from './product-stats';
import {ProductsTable} from './products-table';
import {SearchInput} from './search-input';

export default async function ProductsPage({
  searchParams
}: {
  searchParams: Promise<{q?: string; archived?: string; page?: string; per?: string}>;
}) {
  const session = await requirePageStaff();
  const {q, archived, page: rawPage, per} = await searchParams;
  const includeArchived = archived === '1';
  // Both URL values go through the shared scalar guards — never parsed here.
  const page = parsePage(rawPage);
  const pageSize = parsePageSize(per);
  const [t, {products, total}, parameters] = await Promise.all([
    getTranslations('admin.list'),
    listProducts({search: q?.trim() || undefined, includeArchived, page, pageSize}),
    getParameters()
  ]);

  // Non-page params, preserved by pagination links — `per` included, so paging
  // forward keeps the chosen rows-per-page.
  const paginationParams: Record<string, string> = {};
  if (q?.trim()) paginationParams.q = q.trim();
  if (includeArchived) paginationParams.archived = '1';
  if (per) paginationParams.per = String(pageSize);
  const {from, to} = pageRange(page, pageSize, total);

  // The low-stock band is owner-configured, so the counters can only be queried
  // once the parameters are in hand — one extra round trip after the pair above.
  const stats = await getProductStats(parameters.lastChanceThreshold);

  return (
    <div className="flex flex-col gap-5">
      <ProductStats stats={stats} lowStockThreshold={parameters.lastChanceThreshold} />
      <ProductsTable
        products={products}
        total={total}
        isAdmin={session.user.role === 'ADMIN'}
        includeArchived={includeArchived}
        lowStockThreshold={parameters.lastChanceThreshold}
        currencyLabel={parameters.currency}
        search={<SearchInput initialValue={q ?? ''} includeArchived={includeArchived} />}
        pagination={
          <AdminPagination
            basePath="/admin/products"
            page={page}
            totalPages={totalPages(total, pageSize)}
            params={paginationParams}
            prevLabel={t('prev')}
            nextLabel={t('next')}
            pageSize={pageSize}
            rangeLabel={t('range', {from, to, total})}
          />
        }
      />
    </div>
  );
}
