import {getTranslations, setRequestLocale} from 'next-intl/server';
import {auth} from '@/auth';
import {prisma} from '@/lib/db';
import {validatePromoCode} from '@/server/promo';
import {getMassDiscountPct, getParameters} from '@/server/settings';
import {CheckoutForm, type CheckoutPrefill} from './checkout-form';

import {NO_INDEX} from '@/lib/seo';

// Signed-in / transactional surface: never indexed. See NO_INDEX.
export const metadata = NO_INDEX;

type PageProps = {
  params: Promise<{locale: string}>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CheckoutPage({params, searchParams}: PageProps) {
  const {locale} = await params;
  setRequestLocale(locale);
  const sp = await searchParams;

  const [t, session, parameters, massDiscountPct] = await Promise.all([
    getTranslations('checkout'),
    auth(),
    getParameters(),
    getMassDiscountPct()
  ]);

  // ?promo=CODE arrives from the cart CTA. Validated server-side here so the
  // client summary can show the real percentOff — advisory only, placeOrder
  // runs the triple-check again. URL params can repeat: scalar strings only.
  const promoParam = typeof sp.promo === 'string' ? sp.promo : '';
  const promo = promoParam ? await validatePromoCode(promoParam) : null;

  // Prefill from the logged-in user's profile where present (any role may
  // order). The session only carries id/name/email, so the profile fields
  // come from the DB.
  let prefill: CheckoutPrefill = {name: '', phone: '', address: '', city: ''};
  const userId = session?.user?.id;
  if (userId) {
    const user = await prisma.user.findUnique({
      where: {id: userId},
      select: {name: true, phone: true, address: true, city: true}
    });
    if (user) {
      prefill = {
        name: user.name,
        phone: user.phone ?? '',
        address: user.address ?? '',
        city: user.city ?? ''
      };
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-10">
      <h1 className="text-3xl leading-none font-extrabold sm:text-4xl">{t('title')}</h1>
      <CheckoutForm
        locale={locale}
        deliveryCostMillimes={parameters.deliveryCostMillimes}
        freeDeliveryThresholdMillimes={parameters.freeDeliveryThresholdMillimes}
        currencyLabel={parameters.currency}
        massDiscountPct={massDiscountPct}
        promo={promo}
        prefill={prefill}
      />
    </div>
  );
}
