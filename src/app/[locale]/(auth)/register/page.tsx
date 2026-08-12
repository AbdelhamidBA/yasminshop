import {getTranslations} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {RegisterForm} from './register-form';

// Public page (the proxy only guards /admin — no middleware change needed).
export default async function RegisterPage() {
  const t = await getTranslations('authPages');

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">{t('register.title')}</h1>
      <RegisterForm />
      <p className="text-center text-sm text-muted-foreground">
        {t('links.haveAccount')}{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          {t('links.signIn')}
        </Link>
      </p>
    </main>
  );
}
