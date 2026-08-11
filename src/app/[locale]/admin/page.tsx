import {getTranslations} from 'next-intl/server';
import {auth} from '@/auth';

export default async function AdminOverviewPage() {
  const t = await getTranslations();
  const session = await auth();

  return (
    <div>
      <h1 className="text-2xl font-semibold">
        {t('common.welcome')}, {session?.user.name}
      </h1>
      <p className="mt-2 text-muted-foreground">{t('admin.nav.overview')}</p>
    </div>
  );
}
