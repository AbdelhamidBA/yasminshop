import {getTranslations} from 'next-intl/server';
import {HandCoins, Tag, Truck} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';
import {formatMillimes} from '@/lib/money';

type AnnouncementBarProps = {
  // REAL parameters (Setting rows via getParameters) — the same threshold the
  // cart/checkout delivery math uses, so the banner can never overpromise.
  freeDeliveryThresholdMillimes: number;
  currencyLabel: string;
};

// YasmineShop service bar (Phase 8): the mockup's 3-item strip on the soft
// beige token. Honest copy only — delivery coverage + cash on delivery are the
// store's real promises, and the free-delivery figure is read from the live
// freeDeliveryThresholdMillimes parameter (the item is simply omitted while
// the threshold is disabled). No returns/refund claim: no such policy exists.
export async function AnnouncementBar({
  freeDeliveryThresholdMillimes,
  currencyLabel
}: AnnouncementBarProps) {
  const t = await getTranslations('announcement');

  const items: {icon: LucideIcon; label: string}[] = [
    {icon: Truck, label: t('delivery')},
    {icon: HandCoins, label: t('cod')}
  ];
  if (freeDeliveryThresholdMillimes > 0) {
    items.push({
      icon: Tag,
      label: t('freeDeliveryFrom', {
        amount: formatMillimes(freeDeliveryThresholdMillimes),
        currency: currencyLabel
      })
    });
  }

  return (
    <div className="border-b bg-secondary text-secondary-foreground">
      <ul className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-1 px-4 py-2 text-xs font-medium">
        {items.map(({icon: Icon, label}) => (
          <li key={label} className="flex items-center gap-1.5">
            <Icon className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}
