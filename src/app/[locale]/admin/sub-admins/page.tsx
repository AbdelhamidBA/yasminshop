import {notFound} from 'next/navigation';
import {getTranslations} from 'next-intl/server';
import {auth} from '@/auth';

export default async function SubAdminsPage() {
  const session = await auth();
  if (session?.user.role !== 'ADMIN') notFound();

  const t = await getTranslations('admin.nav');

  return <h1 className="text-2xl font-semibold">{t('subAdmins')}</h1>;
}
