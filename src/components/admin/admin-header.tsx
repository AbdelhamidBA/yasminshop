import {Bell} from 'lucide-react';
import {getTranslations} from 'next-intl/server';
import {LanguageSwitcher} from '@/components/language-switcher';
import {LogoutButton} from '@/components/logout-button';
import {ThemeToggle} from '@/components/theme-toggle';

export async function AdminHeader({userName}: {userName: string}) {
  const t = await getTranslations('admin');

  return (
    <header className="flex h-16 items-center gap-2 border-b px-6">
      <div className="ms-auto flex items-center gap-2">
        <span
          aria-label={t('notifications')}
          className="flex size-9 items-center justify-center rounded-md border"
        >
          <Bell className="size-4" />
        </span>
        <LanguageSwitcher />
        <ThemeToggle />
        <span className="ms-2 text-sm font-medium">{userName}</span>
        <LogoutButton />
      </div>
    </header>
  );
}
