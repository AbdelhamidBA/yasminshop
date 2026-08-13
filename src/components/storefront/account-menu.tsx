'use client';

import {User} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {useTheme} from 'next-themes';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {Link} from '@/i18n/navigation';

type AccountMenuProps = {
  isAuthenticated: boolean;
  // ADMIN or SUB_ADMIN — shows the dashboard shortcut.
  isStaff: boolean;
  // Server action passed down from the (server) SiteHeader: the logout entry
  // stays a real <button type="submit"> inside a form so it still POSTs.
  logoutAction: () => Promise<void>;
};

// Mockup icon group entry: the person icon opens a Base UI menu with the
// account links (signed-out: login/register; signed-in: my orders, dashboard
// for staff, logout), then — below a separator — the theme toggle, which
// leaves the header row (the mockup shows only 3 icons).
export function AccountMenu({isAuthenticated, isStaff, logoutAction}: AccountMenuProps) {
  const t = useTranslations();
  const {resolvedTheme, setTheme} = useTheme();

  const itemCls = 'cursor-pointer px-2.5 py-2';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('nav.account')}
        className="flex size-9 items-center justify-center rounded-md border outline-none hover:bg-accent data-popup-open:bg-accent"
      >
        <User className="size-4" aria-hidden="true" />
      </DropdownMenuTrigger>
      {/* theme-yasmine: the popup portals to <body>, outside the storefront
          layout wrapper, so it carries the token scope itself. */}
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="theme-yasmine w-auto min-w-52 rounded-lg p-1.5"
      >
        {isAuthenticated ? (
          <>
            <DropdownMenuItem render={<Link href="/account/orders" />} className={itemCls}>
              {t('myOrders.title')}
            </DropdownMenuItem>
            {isStaff && (
              <DropdownMenuItem render={<Link href="/admin" />} className={itemCls}>
                {t('admin.blocks.dashboard')}
              </DropdownMenuItem>
            )}
            {/* The existing sign-out server action, kept as a real submit
                button inside its form — the menu item IS the button, so the
                click both closes the menu and POSTs the action. */}
            <form action={logoutAction}>
              <DropdownMenuItem
                render={<button type="submit" />}
                className={`w-full ${itemCls}`}
              >
                {t('common.logout')}
              </DropdownMenuItem>
            </form>
          </>
        ) : (
          <>
            <DropdownMenuItem render={<Link href="/login" />} className={itemCls}>
              {t('common.login')}
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/register" />} className={itemCls}>
              {t('authPages.links.register')}
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        {/* Theme toggle — stays open so the flip is visible in place. */}
        <DropdownMenuItem
          closeOnClick={false}
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          className={itemCls}
        >
          {t('common.theme.toggle')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
