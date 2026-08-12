import type {ReactNode} from 'react';
import {auth} from '@/auth';
import {CartDrawer} from '@/components/cart/cart-drawer';
import {CartProvider} from '@/components/cart/cart-provider';
import {AnnouncementBar} from '@/components/storefront/announcement-bar';
import {BottomNav} from '@/components/storefront/bottom-nav';
import {SiteFooter} from '@/components/storefront/site-footer';
import {SiteHeader} from '@/components/storefront/site-header';
import {getParameters} from '@/server/settings';

export default async function StorefrontLayout({children}: {children: ReactNode}) {
  const [session, parameters] = await Promise.all([auth(), getParameters()]);

  return (
    <CartProvider>
      {/* Bottom padding clears the fixed mobile bottom navbar (+ device
          safe-area inset) so page footers never sit underneath it. */}
      <div className="flex min-h-svh flex-col pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
        <AnnouncementBar
          freeDeliveryThresholdMillimes={parameters.freeDeliveryThresholdMillimes}
          currencyLabel={parameters.currency}
        />
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </div>
      {/* Portal-based drawer + fixed bottom navbar live outside the column so
          the flex layout never has to account for them. */}
      <CartDrawer currencyLabel={parameters.currency} />
      <BottomNav isAuthenticated={session !== null} />
    </CartProvider>
  );
}
