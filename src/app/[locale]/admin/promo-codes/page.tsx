import {getTranslations} from 'next-intl/server';
import {AdminPagination} from '@/components/admin/admin-pagination';
import {pageRange, parsePage, parsePageSize, totalPages} from '@/lib/pagination';
import {requirePageStaff} from '@/server/authz';
import {listPromoCodes} from '@/server/promo-codes';
import {PromoCodesTable} from './promo-codes-table';

export default async function PromoCodesPage({
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

  const [t, {promoCodes, total}] = await Promise.all([
    getTranslations('admin.list'),
    listPromoCodes({includeArchived, page, pageSize})
  ]);

  // Non-page params, preserved by pagination links — `per` included, so paging
  // forward keeps the chosen rows-per-page.
  const paginationParams: Record<string, string> = {};
  if (includeArchived) paginationParams.archived = '1';
  if (per) paginationParams.per = String(pageSize);
  const {from, to} = pageRange(page, pageSize, total);

  return (
    <PromoCodesTable
      promoCodes={promoCodes}
      total={total}
      isAdmin={session.user.role === 'ADMIN'}
      includeArchived={includeArchived}
      pagination={
        <AdminPagination
          basePath="/admin/promo-codes"
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
