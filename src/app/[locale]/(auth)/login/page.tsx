import {getTranslations} from 'next-intl/server';
import {LoginForm} from './login-form';

export default async function LoginPage() {
  const t = await getTranslations('auth');

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">{t('signIn')}</h1>
      <LoginForm />
    </main>
  );
}
