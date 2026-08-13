import {getTranslations} from 'next-intl/server';
import {AdminPagination} from '@/components/admin/admin-pagination';
import {FilterTabs, type FilterTab} from '@/components/admin/filter-tabs';
import {parseStockFilter} from '@/lib/inventory';
import {pageRange, parsePage, parsePageSize, totalPages} from '@/lib/pagination';
import {requirePageStaff} from '@/server/authz';
import {getProductStats, listProducts} from '@/server/products';
import {getParameters} from '@/server/settings';
import {ProductsTable} from './products-table';
import {SearchInput} from './search-input';

export default async function ProductsPage({
  searchParams
}: {
  searchParams: Promise<{
    q?: string;
    archived?: string;
    stock?: string;
    page?: string;
    per?: string;
  }>;
}) {
  const session = await requirePageStaff();
  const {q, archived, stock: rawStock, page: rawPage, per} = await searchParams;
  // The Archivés tab is a scope of its own: archived rows ONLY, and never
  // graded by stock (an archived product is out of the catalogue), so the two
  // filters can never combine into a view no tab represents.
  const archivedOnly = archived === '1';
  const stock = archivedOnly ? undefined : parseStockFilter(rawStock);
  // Every URL value goes through the shared scalar guards — never parsed here.
  const page = parsePage(rawPage);
  const pageSize = parsePageSize(per);
  const search = q?.trim() || undefined;

  // The low-stock band is owner-configured, so neither the filtered list nor
  // the counters can be queried until the parameters are in hand.
  const parameters = await getParameters();
  const scope = {archivedOnly, stock, lastChanceThreshold: parameters.lastChanceThreshold};
  const [t, tTabs, {products, total}, stats] = await Promise.all([
    getTranslations('admin.list'),
    getTranslations('admin.products.tabs'),
    listProducts({...scope, search, page, pageSize}),
    getProductStats({lastChanceThreshold: parameters.lastChanceThreshold, search})
  ]);

  // The params a tab carries across: the search and the rows-per-page choice
  // survive, `page` deliberately does not — a new filter starts at page 1, or
  // the operator lands on an empty page 3 of a two-page list.
  const tabHref = (filter?: Record<string, string>) => {
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    for (const [key, value] of Object.entries(filter ?? {})) params.set(key, value);
    if (per) params.set('per', String(pageSize));
    return `/admin/products${params.size ? `?${params}` : ''}`;
  };

  // Counts come from getProductStats, which asks the SAME question the list
  // below answers, so a tab can never disagree with its own rows.
  const tabs: FilterTab[] = [
    {
      key: 'active',
      label: tTabs('active'),
      count: stats.total,
      href: tabHref(),
      active: !archivedOnly && stock === undefined,
      tone: 'primary'
    },
    {
      key: 'outOfStock',
      label: tTabs('outOfStock'),
      count: stats.outOfStock,
      href: tabHref({stock: 'out'}),
      active: stock === 'out',
      tone: 'error'
    },
    {
      key: 'lowStock',
      label: tTabs('lowStock'),
      count: stats.lowStock,
      href: tabHref({stock: 'low'}),
      active: stock === 'low',
      tone: 'warning'
    },
    {
      key: 'archived',
      label: tTabs('archived'),
      count: stats.archived,
      href: tabHref({archived: '1'}),
      active: archivedOnly,
      tone: 'neutral'
    }
  ];

  // The active filter, as query params — the search box and the pagination
  // links both keep the operator on the tab they are standing on.
  const filterParams: Record<string, string> = {};
  if (archivedOnly) filterParams.archived = '1';
  if (stock) filterParams.stock = stock;

  // Non-page params, preserved by pagination links — `per` included, so paging
  // forward keeps the chosen rows-per-page.
  const paginationParams: Record<string, string> = {...filterParams};
  if (search) paginationParams.q = search;
  if (per) paginationParams.per = String(pageSize);
  const {from, to} = pageRange(page, pageSize, total);

  const searchParamsToKeep = {...filterParams};
  if (per) searchParamsToKeep.per = String(pageSize);

  return (
    <ProductsTable
      products={products}
      total={total}
      isAdmin={session.user.role === 'ADMIN'}
      archivedOnly={archivedOnly}
      lowStockThreshold={parameters.lastChanceThreshold}
      currencyLabel={parameters.currency}
      tabs={<FilterTabs tabs={tabs} label={tTabs('label')} />}
      search={<SearchInput initialValue={q ?? ''} keep={searchParamsToKeep} />}
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
  );
}
