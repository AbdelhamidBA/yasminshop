import {getTranslations, setRequestLocale} from 'next-intl/server';
import {getMassDiscountPct, getParameters} from '@/server/settings';
import {CartView} from './cart-view';

// Server shell: auth-agnostic on purpose (guests build carts too) — it only
// fetches the settings the client view cannot, then hands off to the client
// cart (localStorage is the single source of truth for the lines).
export default async function CartPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale);

  const [t, parameters, massDiscountPct] = await Promise.all([
    getTranslations('cart'),
    getParameters(),
    getMassDiscountPct()
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-10">
      {/* Display role for the page title; the item count (client state) is
          rendered by CartView right underneath. */}
      <h1 className="text-3xl leading-none font-extrabold sm:text-4xl">{t('title')}</h1>
      <CartView
        locale={locale}
        deliveryCostMillimes={parameters.deliveryCostMillimes}
        freeDeliveryThresholdMillimes={parameters.freeDeliveryThresholdMillimes}
        currencyLabel={parameters.currency}
        massDiscountPct={massDiscountPct}
      />
    </div>
  );
}
