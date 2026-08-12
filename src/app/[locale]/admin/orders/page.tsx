import {getTranslations} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {ALLOWED_TRANSITIONS, type OrderStatus} from '@/lib/orders';
import {cn} from '@/lib/utils';
import {requirePageStaff} from '@/server/authz';
import {listOrders} from '@/server/orders';
import {getParameters} from '@/server/settings';
import {OrdersPagination} from './orders-pagination';
import {OrdersSearch} from './orders-search';
import {OrdersTable} from './orders-table';

const PAGE_SIZE = 20;

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
  searchParams: Promise<{status?: string; q?: string; archived?: string; page?: string}>;
}) {
  const session = await requirePageStaff();
  const params = await searchParams;
  const status = parseStatus(params.status);
  const q = typeof params.q === 'string' ? params.q.trim() : '';
  const includeArchived = params.archived === '1';
  const page =
    typeof params.page === 'string' && /^\d{1,4}$/.test(params.page)
      ? Number.parseInt(params.page, 10)
      : 1;

  const [t, parameters, {orders, total}] = await Promise.all([
    getTranslations('adminOrders'),
    getParameters(),
    listOrders({status, q: q || undefined, includeArchived, page, pageSize: PAGE_SIZE})
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

  const tabClass = (active: boolean) =>
    cn(
      'inline-flex h-8 items-center rounded-md px-3 text-sm font-medium transition-colors',
      active ? 'bg-primary text-primary-foreground' : 'border hover:bg-accent'
    );

  const paginationParams = {...baseParams};
  if (status) paginationParams.status = status;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <div className="flex flex-wrap items-center gap-2" role="navigation" aria-label={t('statusHeader')}>
        <Link href={tabHref(undefined)} className={tabClass(status === undefined)}>
          {t('tabs.all')}
        </Link>
        {ORDER_STATUSES.map((s) => (
          <Link key={s} href={tabHref(s)} className={tabClass(status === s)}>
            {t(`status.${s}` as never)}
          </Link>
        ))}
      </div>
      <OrdersSearch initialValue={q} status={status} includeArchived={includeArchived} />
      <OrdersTable
        orders={orders}
        isAdmin={session.user.role === 'ADMIN'}
        includeArchived={includeArchived}
        currencyLabel={parameters.currency}
      />
      <OrdersPagination
        page={page}
        totalPages={Math.ceil(total / PAGE_SIZE)}
        params={paginationParams}
        prevLabel={t('prev')}
        nextLabel={t('next')}
      />
    </div>
  );
}
