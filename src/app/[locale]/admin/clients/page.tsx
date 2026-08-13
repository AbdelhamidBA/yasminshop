import {getTranslations} from 'next-intl/server';
import {AdminPagination} from '@/components/admin/admin-pagination';
import {pageRange, parsePage, parsePageSize, totalPages} from '@/lib/pagination';
import {requirePageStaff} from '@/server/authz';
import {listClients} from '@/server/clients';
import {ClientsSearch} from './clients-search';
import {ClientsTable} from './clients-table';

export default async function ClientsPage({
  searchParams
}: {
  searchParams: Promise<{q?: string; archived?: string; page?: string; per?: string}>;
}) {
  const session = await requirePageStaff();
  const params = await searchParams;
  // Scalar guards on every URL-sourced value (orders-page idiom).
  const q = typeof params.q === 'string' ? params.q.trim() : '';
  const includeArchived = params.archived === '1';
  const page = parsePage(params.page);
  const pageSize = parsePageSize(params.per);

  const [t, tList, {clients, total}] = await Promise.all([
    getTranslations('adminClients'),
    getTranslations('admin.list'),
    listClients({q: q || undefined, includeArchived, page, pageSize})
  ]);

  // Non-page params, preserved by pagination links — `per` included, so paging
  // forward keeps the chosen rows-per-page.
  const paginationParams: Record<string, string> = {};
  if (q) paginationParams.q = q;
  if (includeArchived) paginationParams.archived = '1';
  if (params.per) paginationParams.per = String(pageSize);
  const {from, to} = pageRange(page, pageSize, total);

  return (
    <ClientsTable
      clients={clients}
      total={total}
      isAdmin={session.user.role === 'ADMIN'}
      includeArchived={includeArchived}
      search={<ClientsSearch initialValue={q} includeArchived={includeArchived} />}
      pagination={
        <AdminPagination
          basePath="/admin/clients"
          page={page}
          totalPages={totalPages(total, pageSize)}
          params={paginationParams}
          prevLabel={t('prev')}
          nextLabel={t('next')}
          pageSize={pageSize}
          rangeLabel={tList('range', {from, to, total})}
        />
      }
    />
  );
}
