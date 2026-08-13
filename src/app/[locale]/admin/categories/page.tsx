import {requirePageStaff} from '@/server/authz';
import {listParentOptions, listRootCategories} from '@/server/categories';
import {CategoriesTable} from './categories-table';

export default async function CategoriesPage({
  searchParams
}: {
  searchParams: Promise<{archived?: string}>;
}) {
  const session = await requirePageStaff();
  const {archived} = await searchParams;
  const includeArchived = archived === '1';
  const [categories, parentOptions] = await Promise.all([
    listRootCategories(includeArchived),
    listParentOptions()
  ]);

  return (
    <CategoriesTable
      categories={categories}
      parentOptions={parentOptions}
      isAdmin={session.user.role === 'ADMIN'}
      includeArchived={includeArchived}
    />
  );
}
