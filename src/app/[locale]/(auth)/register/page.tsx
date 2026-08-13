import {getTranslations} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {RegisterForm} from './register-form';

// Public page (the proxy only guards /admin — no middleware change needed).
export default async function RegisterPage() {
  const t = await getTranslations('authPages');

  return (
    <>
      <h1 className="text-3xl leading-none font-extrabold">{t('register.title')}</h1>
      <div className="mt-8">
        <RegisterForm />
      </div>
      <p className="mt-8 border-t border-dotted pt-6 text-sm text-muted-foreground">
        {t('links.haveAccount')}{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          {t('links.signIn')}
        </Link>
      </p>
    </>
  );
}
