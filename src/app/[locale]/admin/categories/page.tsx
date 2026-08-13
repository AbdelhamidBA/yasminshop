import {getTranslations} from 'next-intl/server';
import {AdminPagination} from '@/components/admin/admin-pagination';
import {FilterTabs, type FilterTab} from '@/components/admin/filter-tabs';
import {pageRange, parsePage, parsePageSize, totalPages} from '@/lib/pagination';
import {requirePageStaff} from '@/server/authz';
import {listParentOptions, listRootCategories} from '@/server/categories';
import {CategoriesTable} from './categories-table';

export default async function CategoriesPage({
  searchParams
}: {
  searchParams: Promise<{archived?: string; page?: string; per?: string}>;
}) {
  const session = await requirePageStaff();
  const {archived, page: rawPage, per} = await searchParams;
  // The Archivées tab is a scope of its own: archived rows ONLY, never mixed
  // with the live ones. Every URL value goes through the shared scalar guards.
  const archivedOnly = archived === '1';
  const page = parsePage(rawPage);
  const pageSize = parsePageSize(per);

  // The page slices ROOTS: every sub-category travels with its parent, so the
  // tab counts, `total` and the range below all count root categories, never
  // flat rows. listParentOptions stays unpaginated on purpose — it feeds the
  // create/edit dialog's parent picker, which must offer every root, not just
  // this page's.
  const [t, tList, {categories, counts, total}, parentOptions] = await Promise.all([
    getTranslations('admin.categories'),
    getTranslations('admin.list'),
    listRootCategories({archivedOnly, page, pageSize}),
    listParentOptions()
  ]);

  // The params a tab carries across: the rows-per-page choice survives, `page`
  // deliberately does not — a new filter starts at page 1, or the operator
  // lands on an empty page 3 of a two-page list. (This list has no search box.)
  const tabHref = (filter?: Record<string, string>) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(filter ?? {})) search.set(key, value);
    if (per) search.set('per', String(pageSize));
    return `/admin/categories${search.size ? `?${search}` : ''}`;
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
  if (archivedOnly) paginationParams.archived = '1';
  if (per) paginationParams.per = String(pageSize);
  const {from, to} = pageRange(page, pageSize, total);

  return (
    <CategoriesTable
      categories={categories}
      total={total}
      parentOptions={parentOptions}
      isAdmin={session.user.role === 'ADMIN'}
      archivedView={archivedOnly}
      tabs={<FilterTabs tabs={tabs} label={t('tabs.label')} />}
      pagination={
        <AdminPagination
          basePath="/admin/categories"
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
