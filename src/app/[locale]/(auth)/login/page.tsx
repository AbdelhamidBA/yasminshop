import {getTranslations} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {LoginForm} from './login-form';

export default async function LoginPage() {
  const t = await getTranslations('auth');
  const tPages = await getTranslations('authPages');

  return (
    <>
      <h1 className="text-3xl leading-none font-extrabold">{t('signIn')}</h1>
      <div className="mt-8">
        <LoginForm />
      </div>
      <div className="mt-8 flex flex-col gap-2 border-t border-dotted pt-6 text-sm text-muted-foreground">
        <p>
          <Link href="/reset-password" className="font-medium text-primary hover:underline">
            {tPages('links.forgotPassword')}
          </Link>
        </p>
        <p>
          {tPages('links.noAccount')}{' '}
          <Link href="/register" className="font-medium text-primary hover:underline">
            {tPages('links.register')}
          </Link>
        </p>
      </div>
    </>
  );
}
