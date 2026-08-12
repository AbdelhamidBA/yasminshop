import {getTranslations} from 'next-intl/server';
import {formatMillimes} from '@/lib/money';

type AnnouncementBarProps = {
  // REAL parameters (Setting rows via getParameters) — the same threshold the
  // cart/checkout delivery math uses, so the banner can never overpromise.
  freeDeliveryThresholdMillimes: number;
  currencyLabel: string;
};

// Slim karina-style announcement bar above the header. Honest copy only: the
// free-delivery figure is read from the live freeDeliveryThresholdMillimes
// parameter; when the threshold is disabled (0) it falls back to the generic
// delivery/COD line ("Paiement à la livraison" is the store's real, existing
// trust-badge promise). Token colors only — primary inverts cleanly in dark.
export async function AnnouncementBar({
  freeDeliveryThresholdMillimes,
  currencyLabel
}: AnnouncementBarProps) {
  const t = await getTranslations('announcement');
  const message =
    freeDeliveryThresholdMillimes > 0
      ? t('freeDeliveryFrom', {
          amount: formatMillimes(freeDeliveryThresholdMillimes),
          currency: currencyLabel
        })
      : t('generic');

  return (
    <p className="bg-primary px-4 py-1.5 text-center text-xs font-medium text-primary-foreground">
      <span aria-hidden="true" className="me-2 opacity-70">
        ✦
      </span>
      {message}
      <span aria-hidden="true" className="ms-2 opacity-70">
        ✦
      </span>
    </p>
  );
}
