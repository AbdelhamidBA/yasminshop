import type {ReactNode} from 'react';
import {getLocale} from 'next-intl/server';
import {auth} from '@/auth';
import {redirect} from '@/i18n/navigation';
import {AdminHeader} from '@/components/admin/admin-header';
import {AdminSidebar} from '@/components/admin/admin-sidebar';

export default async function AdminLayout({children}: {children: ReactNode}) {
  const session = await auth();
  const locale = await getLocale();
  const role = session?.user.role;

  if (role !== 'ADMIN' && role !== 'SUB_ADMIN') {
    redirect({href: '/login', locale});
  }

  return (
    // theme-minimal scopes the dashboard palette (see globals.css) so the
    // storefront's champagne-gold brand and the auth screens keep theirs.
    // Portalled admin surfaces (dialogs, dropdowns) must carry the class too.
    <div className="theme-minimal flex min-h-svh bg-background text-foreground">
      <AdminSidebar isAdmin={role === 'ADMIN'} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminHeader userName={session?.user.name ?? ''} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
