import {getTranslations} from 'next-intl/server';
import {AdminPagination} from '@/components/admin/admin-pagination';
import {FilterTabs, type FilterTab} from '@/components/admin/filter-tabs';
import {ALLOWED_TRANSITIONS, type OrderStatus} from '@/lib/orders';
import {pageRange, parsePage, parsePageSize, totalPages} from '@/lib/pagination';
import {requirePageStaff} from '@/server/authz';
import {getOrderStats, listOrders} from '@/server/orders';
import {getParameters} from '@/server/settings';
import type {AdminTone} from '@/components/admin/ui';
import {OrdersSearch} from './orders-search';
import {OrdersTable} from './orders-table';

// Derived from the transition table so the whitelist can never drift from the
// engine's enum (Task 2 carry-forward: the URL value is WHITELISTED before it
// reaches listOrders — anything else is treated as absent).
const ORDER_STATUSES = Object.keys(ALLOWED_TRANSITIONS) as OrderStatus[];

// The status tabs read like the badges in the rows below them: a pending order
// is the one still asking for attention, a canceled one is a loss.
const STATUS_TONE: Record<OrderStatus, AdminTone> = {
  PENDING: 'warning',
  CONFIRMED: 'info',
  DELIVERED: 'success',
  CANCELED: 'error'
};

function parseStatus(value: string | undefined): OrderStatus | undefined {
  return typeof value === 'string' && (ORDER_STATUSES as string[]).includes(value)
    ? (value as OrderStatus)
    : undefined;
}

export default async function OrdersPage({
  searchParams
}: {
  searchParams: Promise<{
    status?: string;
    q?: string;
    archived?: string;
    page?: string;
    per?: string;
  }>;
}) {
  const session = await requirePageStaff();
  const params = await searchParams;
  // The Archivées tab is a scope of its own: archived rows ONLY, and never
  // narrowed by status, so the two filters can never combine into a view no
  // tab represents.
  const archivedOnly = params.archived === '1';
  const status = archivedOnly ? undefined : parseStatus(params.status);
  const q = typeof params.q === 'string' ? params.q.trim() : '';
  // Every URL value goes through the shared scalar guards — never parsed here.
  const page = parsePage(params.page);
  const pageSize = parsePageSize(params.per);

  const [t, tList, parameters, {orders, total}, stats] = await Promise.all([
    getTranslations('adminOrders'),
    getTranslations('admin.list'),
    getParameters(),
    listOrders({status, q: q || undefined, archivedOnly, page, pageSize}),
    getOrderStats({q: q || undefined})
  ]);

  // The params a tab carries across: the search and the rows-per-page choice
  // survive, `page` deliberately does not — a new filter starts at page 1, or
  // the operator lands on an empty page 3 of a two-page list.
  const tabHref = (filter?: Record<string, string>) => {
    const search = new URLSearchParams();
    if (q) search.set('q', q);
    for (const [key, value] of Object.entries(filter ?? {})) search.set(key, value);
    if (params.per) search.set('per', String(pageSize));
    return `/admin/orders${search.size ? `?${search}` : ''}`;
  };

  // Counts come from getOrderStats, which asks the SAME question the list below
  // answers, so a tab can never disagree with its own rows.
  const tabs: FilterTab[] = [
    {
      key: 'all',
      label: t('tabs.all'),
      count: stats.all,
      href: tabHref(),
      active: !archivedOnly && status === undefined,
      tone: 'neutral'
    },
    ...ORDER_STATUSES.map((s) => ({
      key: s,
      label: t(`status.${s}` as never),
      count: stats.byStatus[s],
      href: tabHref({status: s}),
      active: status === s,
      tone: STATUS_TONE[s]
    })),
    {
      key: 'archived',
      label: t('tabs.archived'),
      count: stats.archived,
      href: tabHref({archived: '1'}),
      active: archivedOnly,
      tone: 'neutral' as AdminTone
    }
  ];

  // The active filter, as query params — the search box and the pagination
  // links both keep the operator on the tab they are standing on.
  const filterParams: Record<string, string> = {};
  if (archivedOnly) filterParams.archived = '1';
  if (status) filterParams.status = status;

  // `per` rides along with the filters so paging forward keeps the chosen size.
  const paginationParams: Record<string, string> = {...filterParams};
  if (q) paginationParams.q = q;
  if (params.per) paginationParams.per = String(pageSize);
  const {from, to} = pageRange(page, pageSize, total);

  const searchParamsToKeep = {...filterParams};
  if (params.per) searchParamsToKeep.per = String(pageSize);

  return (
    <OrdersTable
      orders={orders}
      total={total}
      isAdmin={session.user.role === 'ADMIN'}
      archivedOnly={archivedOnly}
      currencyLabel={parameters.currency}
      tabs={<FilterTabs tabs={tabs} label={t('tabs.label')} />}
      search={<OrdersSearch initialValue={q} keep={searchParamsToKeep} />}
      pagination={
        <AdminPagination
          basePath="/admin/orders"
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
