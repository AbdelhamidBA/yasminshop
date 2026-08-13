import {getTranslations} from 'next-intl/server';
import {AdminPagination} from '@/components/admin/admin-pagination';
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
  const includeArchived = archived === '1';
  // Both URL values go through the shared scalar guards — never parsed here.
  const page = parsePage(rawPage);
  const pageSize = parsePageSize(per);

  // The page slices ROOTS: every sub-category travels with its parent, so
  // `total` (and the range below) count root categories, never flat rows.
  // listParentOptions stays unpaginated on purpose — it feeds the create/edit
  // dialog's parent picker, which must offer every root, not just this page's.
  const [t, {categories, total}, parentOptions] = await Promise.all([
    getTranslations('admin.list'),
    listRootCategories({includeArchived, page, pageSize}),
    listParentOptions()
  ]);

  // Non-page params, preserved by pagination links — `per` included, so paging
  // forward keeps the chosen rows-per-page.
  const paginationParams: Record<string, string> = {};
  if (includeArchived) paginationParams.archived = '1';
  if (per) paginationParams.per = String(pageSize);
  const {from, to} = pageRange(page, pageSize, total);

  return (
    <CategoriesTable
      categories={categories}
      total={total}
      parentOptions={parentOptions}
      isAdmin={session.user.role === 'ADMIN'}
      includeArchived={includeArchived}
      pagination={
        <AdminPagination
          basePath="/admin/categories"
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
