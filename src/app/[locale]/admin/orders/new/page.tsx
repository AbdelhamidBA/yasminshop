import {ArrowLeft} from 'lucide-react';
import {getLocale, getTranslations} from 'next-intl/server';
import {PageHeader, PageTitle} from '@/components/admin/form';
import {Button} from '@/components/ui/button';
import {Link, redirect} from '@/i18n/navigation';
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
      <PageHeader
        back={
          <Button
            variant="ghost"
            size="icon"
            className="size-10 rounded-full"
            aria-label={t('backToList')}
            render={<Link href="/admin/orders" />}
          >
            <ArrowLeft className="rtl:rotate-180" />
          </Button>
        }
        title={<PageTitle>{t('new.title')}</PageTitle>}
      />
      <ManualOrderForm
        deliveryCostMillimes={parameters.deliveryCostMillimes}
        freeDeliveryThresholdMillimes={parameters.freeDeliveryThresholdMillimes}
        currencyLabel={parameters.currency}
        massDiscountPct={massDiscountPct}
        wholesaleMinQty={parameters.wholesaleMinQty}
      />
    </div>
  );
}
