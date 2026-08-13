import {getTranslations} from 'next-intl/server';
import {signOut} from '@/auth';
import {routing} from '@/i18n/routing';

export async function LogoutButton() {
  const t = await getTranslations('common');

  return (
    <form
      action={async () => {
        'use server';
        // Locale-prefixed on purpose: a bare '/' leans on the proxy to redirect,
        // and that middleware hop does not resolve during the client-side
        // navigation this action performs — the address bar moves while the old
        // page stays on screen until a manual refresh.
        await signOut({redirectTo: `/${routing.defaultLocale}`});
      }}
    >
      <button type="submit" className="text-sm font-medium hover:underline">
        {t('logout')}
      </button>
    </form>
  );
}
