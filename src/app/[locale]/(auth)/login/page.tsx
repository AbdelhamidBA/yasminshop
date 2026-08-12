import {getTranslations} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {LoginForm} from './login-form';

export default async function LoginPage() {
  const t = await getTranslations('auth');
  const tPages = await getTranslations('authPages');

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">{t('signIn')}</h1>
      <LoginForm />
      <div className="flex flex-col gap-2 text-center text-sm text-muted-foreground">
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
    </main>
  );
}
