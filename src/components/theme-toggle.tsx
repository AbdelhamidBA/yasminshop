'use client';

import {useEffect, useState} from 'react';
import {Moon, Sun} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {useTheme} from 'next-themes';

export function ThemeToggle() {
  const {resolvedTheme, setTheme} = useTheme();
  const [mounted, setMounted] = useState(false);
  const t = useTranslations('common.theme');

  useEffect(() => setMounted(true), []);

  return (
    <button
      type="button"
      aria-label={t('toggle')}
      className="flex size-9 items-center justify-center rounded-md border hover:bg-accent"
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
    >
      {mounted && (resolvedTheme === 'dark' ? <Moon className="size-4" /> : <Sun className="size-4" />)}
    </button>
  );
}
