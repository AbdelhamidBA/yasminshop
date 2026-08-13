import {getTranslations} from 'next-intl/server';
import {AdminPagination} from '@/components/admin/admin-pagination';
import {FilterTabs, type FilterTab} from '@/components/admin/filter-tabs';
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
  // Scalar guards on every URL-sourced value (orders-page idiom). The Archivés
  // tab is a scope of its own: archived rows ONLY, never mixed with the live
  // ones, so the two tabs partition the directory between them.
  const q = typeof params.q === 'string' ? params.q.trim() : '';
  const archivedOnly = params.archived === '1';
  const page = parsePage(params.page);
  const pageSize = parsePageSize(params.per);

  const [t, tList, {clients, counts, total}] = await Promise.all([
    getTranslations('adminClients'),
    getTranslations('admin.list'),
    listClients({q: q || undefined, archivedOnly, page, pageSize})
  ]);

  // The params a tab carries across: the search and the rows-per-page choice
  // survive, `page` deliberately does not — a new filter starts at page 1, or
  // the operator lands on an empty page 3 of a two-page list.
  const tabHref = (filter?: Record<string, string>) => {
    const search = new URLSearchParams();
    if (q) search.set('q', q);
    for (const [key, value] of Object.entries(filter ?? {})) search.set(key, value);
    if (params.per) search.set('per', String(pageSize));
    return `/admin/clients${search.size ? `?${search}` : ''}`;
  };

  // Counts come out of the same $transaction — and the same where-clauses — as
  // the rows, so a tab can never disagree with the list it opens.
  const tabs: FilterTab[] = [
    {
      key: 'active',
      label: t('tabs.active'),
      count: counts.active,
      href: tabHref(),
      active: !archivedOnly,
      tone: 'primary'
    },
    {
      key: 'archived',
      label: t('tabs.archived'),
      count: counts.archived,
      href: tabHref({archived: '1'}),
      active: archivedOnly,
      tone: 'neutral'
    }
  ];

  // Non-page params, preserved by pagination links — `per` included, so paging
  // forward keeps the chosen rows-per-page.
  const paginationParams: Record<string, string> = {};
  if (q) paginationParams.q = q;
  if (archivedOnly) paginationParams.archived = '1';
  if (params.per) paginationParams.per = String(pageSize);
  const {from, to} = pageRange(page, pageSize, total);

  return (
    <ClientsTable
      clients={clients}
      total={total}
      isAdmin={session.user.role === 'ADMIN'}
      archivedView={archivedOnly}
      tabs={<FilterTabs tabs={tabs} label={t('tabs.label')} />}
      search={<ClientsSearch initialValue={q} archivedOnly={archivedOnly} />}
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
