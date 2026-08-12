import {getLocale, getTranslations} from 'next-intl/server';
import {redirect} from '@/i18n/navigation';
import {requirePageStaff} from '@/server/authz';
import {getMassDiscountPct, getParameters} from '@/server/settings';
import {ManualOrderForm} from './manual-order-form';

// Manual order creation is ADMIN-only (Global Constraints role split):
// sub-admins are redirected back to the list, exactly like products/new.
export default async function NewOrderPage() {
  const session = await requirePageStaff();
  if (session.user.role !== 'ADMIN') {
    redirect({href: '/admin/orders', locale: await getLocale()});
  }
  const t = await getTranslations('adminOrders');
  const [parameters, massDiscountPct] = await Promise.all([
    getParameters(),
    getMassDiscountPct()
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t('new.title')}</h1>
      <ManualOrderForm
        deliveryCostMillimes={parameters.deliveryCostMillimes}
        freeDeliveryThresholdMillimes={parameters.freeDeliveryThresholdMillimes}
        currencyLabel={parameters.currency}
        massDiscountPct={massDiscountPct}
      />
    </div>
  );
}
