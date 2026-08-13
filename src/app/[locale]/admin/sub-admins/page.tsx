import {notFound} from 'next/navigation';
import {getTranslations} from 'next-intl/server';
import {auth} from '@/auth';
import {requirePageStaff} from '@/server/authz';
import {AdminPagination} from '@/components/admin/admin-pagination';
import {pageRange, parsePage, parsePageSize, totalPages} from '@/lib/pagination';
import {listSubAdmins} from '@/server/sub-admins';
import {SubAdminsSearch} from './sub-admins-search';
import {SubAdminsTable} from './sub-admins-table';

export default async function SubAdminsPage({
  searchParams
}: {
  searchParams: Promise<{q?: string; archived?: string; page?: string; per?: string}>;
}) {
  // Funnel through the revocation check first (DB tokenVersion re-check): a
  // revoked/archived staff token is redirected to /login here, so an ADMIN who
  // self-revoked (password reset) can no longer read the sub-admin directory.
  await requirePageStaff();
  // ADMIN-only surface (kept from the Phase 1 placeholder): the proxy + admin
  // layout already gate /admin to staff, so a SUB_ADMIN reaching this page is
  // shown notFound() rather than redirected. Every action re-checks requireAdmin.
  const session = await auth();
  if (session?.user.role !== 'ADMIN') notFound();

  const params = await searchParams;
  // Scalar guards on every URL-sourced value (clients-page idiom).
  const q = typeof params.q === 'string' ? params.q.trim() : '';
  const includeArchived = params.archived === '1';
  const page = parsePage(params.page);
  const pageSize = parsePageSize(params.per);

  const [t, tList, {subAdmins, total}] = await Promise.all([
    getTranslations('subAdmins'),
    getTranslations('admin.list'),
    listSubAdmins({q: q || undefined, includeArchived, page, pageSize})
  ]);

  // Non-page params, preserved by pagination links — `per` included, so paging
  // forward keeps the chosen rows-per-page.
  const paginationParams: Record<string, string> = {};
  if (q) paginationParams.q = q;
  if (includeArchived) paginationParams.archived = '1';
  if (params.per) paginationParams.per = String(pageSize);
  const {from, to} = pageRange(page, pageSize, total);

  return (
    <SubAdminsTable
      subAdmins={subAdmins}
      total={total}
      includeArchived={includeArchived}
      search={<SubAdminsSearch initialValue={q} includeArchived={includeArchived} />}
      pagination={
        <AdminPagination
          basePath="/admin/sub-admins"
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
