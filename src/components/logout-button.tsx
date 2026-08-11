import {getTranslations} from 'next-intl/server';
import {signOut} from '@/auth';

export async function LogoutButton() {
  const t = await getTranslations('common');

  return (
    <form
      action={async () => {
        'use server';
        await signOut({redirectTo: '/'});
      }}
    >
      <button type="submit" className="text-sm font-medium hover:underline">
        {t('logout')}
      </button>
    </form>
  );
}
