import {getTranslations} from 'next-intl/server';
import {AdminPagination} from '@/components/admin/admin-pagination';
import {FilterTabs, type FilterTab} from '@/components/admin/filter-tabs';
import {pageRange, parsePage, parsePageSize, totalPages} from '@/lib/pagination';
import {requirePageStaff} from '@/server/authz';
import {listPromoCodes, parsePromoCodeFilter} from '@/server/promo-codes';
import {PromoCodesTable} from './promo-codes-table';

export default async function PromoCodesPage({
  searchParams
}: {
  searchParams: Promise<{archived?: string; active?: string; page?: string; per?: string}>;
}) {
  const session = await requirePageStaff();
  const {archived, active, page: rawPage, per} = await searchParams;
  // Three mutually exclusive scopes. `active=0` is not a new state invented for
  // the tabs — it is the very column the per-row Switch (togglePromoCode)
  // writes; archiving stays the separate axis it already was.
  const filter = parsePromoCodeFilter({archived, active});
  // Every URL value goes through the shared scalar guards — never parsed here.
  const page = parsePage(rawPage);
  const pageSize = parsePageSize(per);

  const [t, tList, {promoCodes, counts, total}] = await Promise.all([
    getTranslations('admin.promoCodesPage'),
    getTranslations('admin.list'),
    listPromoCodes({filter, page, pageSize})
  ]);

  // The params a tab carries across: the rows-per-page choice survives, `page`
  // deliberately does not — a new filter starts at page 1, or the operator
  // lands on an empty page 3 of a two-page list. (This list has no search box.)
  const tabHref = (filterParams?: Record<string, string>) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(filterParams ?? {})) search.set(key, value);
    if (per) search.set('per', String(pageSize));
    return `/admin/promo-codes${search.size ? `?${search}` : ''}`;
  };

  // Counts come out of the same $transaction — and the same where-clauses — as
  // the rows, so a tab can never disagree with the list it opens. The tones
  // read the three states at a glance: the live codes are the primary business,
  // a disabled one is a paused warning, an archived one is out of play.
  const tabs: FilterTab[] = [
    {
      key: 'active',
      label: t('tabs.active'),
      count: counts.active,
      href: tabHref(),
      active: filter === 'active',
      tone: 'primary'
    },
    {
      key: 'inactive',
      label: t('tabs.inactive'),
      count: counts.inactive,
      href: tabHref({active: '0'}),
      active: filter === 'inactive',
      tone: 'warning'
    },
    {
      key: 'archived',
      label: t('tabs.archived'),
      count: counts.archived,
      href: tabHref({archived: '1'}),
      active: filter === 'archived',
      tone: 'neutral'
    }
  ];

  // Non-page params, preserved by pagination links — `per` included, so paging
  // forward keeps the chosen rows-per-page.
  const paginationParams: Record<string, string> = {};
  if (filter === 'archived') paginationParams.archived = '1';
  if (filter === 'inactive') paginationParams.active = '0';
  if (per) paginationParams.per = String(pageSize);
  const {from, to} = pageRange(page, pageSize, total);

  return (
    <PromoCodesTable
      promoCodes={promoCodes}
      total={total}
      isAdmin={session.user.role === 'ADMIN'}
      archivedView={filter === 'archived'}
      tabs={<FilterTabs tabs={tabs} label={t('tabs.label')} />}
      pagination={
        <AdminPagination
          basePath="/admin/promo-codes"
          page={page}
          totalPages={totalPages(total, pageSize)}
          params={paginationParams}
          prevLabel={tList('prev')}
          nextLabel={tList('next')}
          pageSize={pageSize}
          rangeLabel={tList('range', {from, to, total})}
        />
      }
    />
  );
}
