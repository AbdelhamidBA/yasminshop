import {ShoppingCart} from 'lucide-react';
import {getTranslations} from 'next-intl/server';
import {auth} from '@/auth';
import {Link} from '@/i18n/navigation';
import {LanguageSwitcher} from '@/components/language-switcher';
import {LogoutButton} from '@/components/logout-button';
import {ThemeToggle} from '@/components/theme-toggle';

export async function SiteHeader() {
  const t = await getTranslations();
  const session = await auth();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="text-lg font-bold">
          {t('common.siteName')}
        </Link>
        <nav className="ms-6 hidden items-center gap-6 text-sm md:flex">
          <Link href="/" className="hover:underline">
            {t('nav.home')}
          </Link>
        </nav>
        <div className="ms-auto flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
          <span
            aria-label={t('common.cart')}
            className="flex size-9 items-center justify-center rounded-md border"
          >
            <ShoppingCart className="size-4" />
          </span>
          {session ? (
            <LogoutButton />
          ) : (
            <Link href="/login" className="text-sm font-medium hover:underline">
              {t('common.login')}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
