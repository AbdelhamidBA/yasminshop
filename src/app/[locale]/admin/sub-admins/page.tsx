import {notFound} from 'next/navigation';
import {getTranslations} from 'next-intl/server';
import {auth} from '@/auth';
import {requirePageStaff} from '@/server/authz';
import {AdminPagination} from '@/components/admin/admin-pagination';
import {listSubAdmins} from '@/server/sub-admins';
import {SubAdminsSearch} from './sub-admins-search';
import {SubAdminsTable} from './sub-admins-table';

const PAGE_SIZE = 20;

export default async function SubAdminsPage({
  searchParams
}: {
  searchParams: Promise<{q?: string; archived?: string; page?: string}>;
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
  const page =
    typeof params.page === 'string' && /^\d{1,4}$/.test(params.page)
      ? Number.parseInt(params.page, 10)
      : 1;

  const [t, {subAdmins, total}] = await Promise.all([
    getTranslations('subAdmins'),
    listSubAdmins({q: q || undefined, includeArchived, page, pageSize: PAGE_SIZE})
  ]);

  // Non-page params, preserved by pagination links.
  const paginationParams: Record<string, string> = {};
  if (q) paginationParams.q = q;
  if (includeArchived) paginationParams.archived = '1';
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <SubAdminsTable
      subAdmins={subAdmins}
      total={total}
      includeArchived={includeArchived}
      search={<SubAdminsSearch initialValue={q} includeArchived={includeArchived} />}
      pagination={
        totalPages > 1 ? (
          <AdminPagination
            basePath="/admin/sub-admins"
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
