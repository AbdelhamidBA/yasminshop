import {getTranslations} from 'next-intl/server';
import {Button} from '@/components/ui/button';
import {Link} from '@/i18n/navigation';
import {RESET_TOKEN_PATTERN} from '@/lib/reset-token';
import {ResetPasswordForm} from './reset-form';

type PageProps = {params: Promise<{token: string}>};

// Public page (the proxy only guards /admin). The token param gets a
// SHAPE-ONLY scalar guard here (hex-64 — no DB lookup, so a GET can't probe
// token state); real validation happens in the resetPassword action, which
// answers every invalid case with the same generic key.
export default async function ResetPasswordTokenPage({params}: PageProps) {
  const {token} = await params;
  const t = await getTranslations('authPages');

  if (!RESET_TOKEN_PATTERN.test(token)) {
    return (
      <main className="mx-auto flex min-h-svh w-full max-w-sm flex-col justify-center gap-6 p-6">
        <h1 className="text-2xl font-semibold">{t('reset.newTitle')}</h1>
        <p className="text-sm text-destructive">{t('errors.invalidToken')}</p>
        <Button variant="outline" render={<Link href="/reset-password" />}>
          {t('reset.requestNew')}
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">{t('reset.newTitle')}</h1>
      <ResetPasswordForm token={token} />
    </main>
  );
}
