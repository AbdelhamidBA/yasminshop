import {getTranslations} from 'next-intl/server';
import {AdminPagination} from '@/components/admin/admin-pagination';
import {Link} from '@/i18n/navigation';
import {ALLOWED_TRANSITIONS, type OrderStatus} from '@/lib/orders';
import {pageRange, parsePage, parsePageSize, totalPages} from '@/lib/pagination';
import {cn} from '@/lib/utils';
import {requirePageStaff} from '@/server/authz';
import {listOrders} from '@/server/orders';
import {getParameters} from '@/server/settings';
import {OrdersSearch} from './orders-search';
import {OrdersTable} from './orders-table';

// Derived from the transition table so the whitelist can never drift from the
// engine's enum (Task 2 carry-forward: the URL value is WHITELISTED before it
// reaches listOrders — anything else is treated as absent).
const ORDER_STATUSES = Object.keys(ALLOWED_TRANSITIONS) as OrderStatus[];

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
  const status = parseStatus(params.status);
  const q = typeof params.q === 'string' ? params.q.trim() : '';
  const includeArchived = params.archived === '1';
  // Both URL values go through the shared scalar guards — never parsed here.
  const page = parsePage(params.page);
  const pageSize = parsePageSize(params.per);

  const [t, tList, parameters, {orders, total}] = await Promise.all([
    getTranslations('adminOrders'),
    getTranslations('admin.list'),
    getParameters(),
    listOrders({status, q: q || undefined, includeArchived, page, pageSize})
  ]);

  // Non-page params, preserved by tab/pagination links and the search form.
  const baseParams: Record<string, string> = {};
  if (q) baseParams.q = q;
  if (includeArchived) baseParams.archived = '1';

  const tabHref = (tabStatus: OrderStatus | undefined) => {
    const search = new URLSearchParams(baseParams);
    if (tabStatus) search.set('status', tabStatus);
    return `/admin/orders${search.size ? `?${search}` : ''}`;
  };

  // Minimal-UI tabs: no chrome, just a solid indicator under the active label.
  const tabClass = (active: boolean) =>
    cn(
      'relative inline-flex h-12 shrink-0 items-center text-sm font-semibold transition-colors',
      'after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full',
      'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
      active
        ? 'text-foreground after:bg-foreground'
        : 'text-muted-foreground after:bg-transparent hover:text-foreground'
    );

  // `per` rides along with the filters so paging forward keeps the chosen size.
  const paginationParams = {...baseParams};
  if (status) paginationParams.status = status;
  if (params.per) paginationParams.per = String(pageSize);
  const {from, to} = pageRange(page, pageSize, total);

  return (
    <OrdersTable
      orders={orders}
      total={total}
      isAdmin={session.user.role === 'ADMIN'}
      includeArchived={includeArchived}
      currencyLabel={parameters.currency}
      tabs={
        <nav
          className="flex gap-6 overflow-x-auto px-4"
          role="navigation"
          aria-label={t('statusHeader')}
        >
          <Link href={tabHref(undefined)} className={tabClass(status === undefined)}>
            {t('tabs.all')}
          </Link>
          {ORDER_STATUSES.map((s) => (
            <Link key={s} href={tabHref(s)} className={tabClass(status === s)}>
              {t(`status.${s}` as never)}
            </Link>
          ))}
        </nav>
      }
      search={<OrdersSearch initialValue={q} status={status} includeArchived={includeArchived} />}
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
