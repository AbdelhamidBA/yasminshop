import {getTranslations} from 'next-intl/server';
import {RotateCcw, ShieldCheck, Truck, Headset} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';

type TrustBadgesProps = {
  // 'strip' is the standalone home band; 'footer' is the compact footer row.
  variant?: 'strip' | 'footer';
};

// Static, honest reassurance badges (spec §6 safe affordance): no backend, no
// fake functionality — just real store promises. Server component so it reads
// the catalog directly. Theme-safe tokens + logical utilities for RTL.
export async function TrustBadges({variant = 'strip'}: TrustBadgesProps) {
  const t = await getTranslations('trust');

  const badges: {icon: LucideIcon; title: string; subtitle: string}[] = [
    {icon: Truck, title: t('shippingTitle'), subtitle: t('shippingSubtitle')},
    {icon: ShieldCheck, title: t('paymentTitle'), subtitle: t('paymentSubtitle')},
    {icon: RotateCcw, title: t('returnsTitle'), subtitle: t('returnsSubtitle')},
    {icon: Headset, title: t('supportTitle'), subtitle: t('supportSubtitle')}
  ];

  const isFooter = variant === 'footer';

  return (
    <ul
      className={
        isFooter
          ? 'grid grid-cols-2 gap-4 sm:grid-cols-4'
          : 'grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4'
      }
    >
      {badges.map(({icon: Icon, title, subtitle}) => (
        <li key={title} className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{title}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {subtitle}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
