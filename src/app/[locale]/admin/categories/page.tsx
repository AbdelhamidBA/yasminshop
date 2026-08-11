import {getTranslations} from 'next-intl/server';
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
  const t = await getTranslations('admin.categories');
  const [categories, parentOptions] = await Promise.all([
    listRootCategories(includeArchived),
    listParentOptions()
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <CategoriesTable
        categories={categories}
        parentOptions={parentOptions}
        isAdmin={session.user.role === 'ADMIN'}
        includeArchived={includeArchived}
      />
    </div>
  );
}
