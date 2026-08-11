import type {ReactNode} from 'react';
import {SiteFooter} from '@/components/storefront/site-footer';
import {SiteHeader} from '@/components/storefront/site-header';

export default function StorefrontLayout({children}: {children: ReactNode}) {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
