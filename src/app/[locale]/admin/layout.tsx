import type {ReactNode} from 'react';
import {getLocale} from 'next-intl/server';
import {auth} from '@/auth';
import {redirect} from '@/i18n/navigation';
import {AdminHeader} from '@/components/admin/admin-header';
import {AdminSidebar} from '@/components/admin/admin-sidebar';

import {NO_INDEX} from '@/lib/seo';

// Signed-in / transactional surface: never indexed. See NO_INDEX.
export const metadata = NO_INDEX;

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
    //
    // App shell: the rail is a STICKY, viewport-tall flex item and the header is
    // sticky inside the content column, so the document's own scroll moves only
    // the page content — nav and header never travel out of reach, and there is
    // still exactly one page scrollbar (no nested scrollport to double it).
    // Below `lg` the rail is not rendered; the header's burger drawer replaces it.
    <div className="theme-minimal flex min-h-svh bg-background text-foreground">
      <AdminSidebar isAdmin={role === 'ADMIN'} />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* The header is sticky + translucent (content scrolls under it), so it
            stays a sibling of main rather than wrapping it. */}
        <AdminHeader userName={session?.user.name ?? ''} isAdmin={role === 'ADMIN'} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
