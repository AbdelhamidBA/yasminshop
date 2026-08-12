import {getTranslations} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {RequestResetForm} from './request-form';

// Public page (the proxy only guards /admin — no middleware change needed).
export default async function ResetPasswordRequestPage() {
  const t = await getTranslations('authPages');

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">{t('reset.requestTitle')}</h1>
      <RequestResetForm />
      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-primary hover:underline">
          {t('links.backToLogin')}
        </Link>
      </p>
    </main>
  );
}
