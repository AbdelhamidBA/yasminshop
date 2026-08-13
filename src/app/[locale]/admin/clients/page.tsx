import {getTranslations} from 'next-intl/server';
import {AdminPagination} from '@/components/admin/admin-pagination';
import {requirePageStaff} from '@/server/authz';
import {listClients} from '@/server/clients';
import {ClientsSearch} from './clients-search';
import {ClientsTable} from './clients-table';

const PAGE_SIZE = 20;

export default async function ClientsPage({
  searchParams
}: {
  searchParams: Promise<{q?: string; archived?: string; page?: string}>;
}) {
  const session = await requirePageStaff();
  const params = await searchParams;
  // Scalar guards on every URL-sourced value (orders-page idiom).
  const q = typeof params.q === 'string' ? params.q.trim() : '';
  const includeArchived = params.archived === '1';
  const page =
    typeof params.page === 'string' && /^\d{1,4}$/.test(params.page)
      ? Number.parseInt(params.page, 10)
      : 1;

  const [t, {clients, total}] = await Promise.all([
    getTranslations('adminClients'),
    listClients({q: q || undefined, includeArchived, page, pageSize: PAGE_SIZE})
  ]);

  // Non-page params, preserved by pagination links.
  const paginationParams: Record<string, string> = {};
  if (q) paginationParams.q = q;
  if (includeArchived) paginationParams.archived = '1';
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <ClientsTable
      clients={clients}
      total={total}
      isAdmin={session.user.role === 'ADMIN'}
      includeArchived={includeArchived}
      search={<ClientsSearch initialValue={q} includeArchived={includeArchived} />}
      pagination={
        totalPages > 1 ? (
          <AdminPagination
            basePath="/admin/clients"
            page={page}
            totalPages={totalPages}
            params={paginationParams}
            prevLabel={t('prev')}
            nextLabel={t('next')}
          />
        ) : null
      }
    />
  );
}
