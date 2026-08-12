import {getTranslations} from 'next-intl/server';
import {HandCoins, ShieldCheck, Truck} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';

// YasmineShop service bar: exactly the mockup's 3-item strip on the soft
// beige token. All three are the store's own policy declarations (owner
// directive via the mockup): nationwide delivery, cash on delivery, and the
// satisfied-or-refunded promise. Evenly spread on sm+, centered wrap on
// mobile (2+1 is fine, never a page overflow). The free-delivery threshold
// line was removed from the bar — the cart totals still surface it.
export async function AnnouncementBar() {
  const t = await getTranslations('announcement');

  const items: {icon: LucideIcon; label: string}[] = [
    {icon: Truck, label: t('delivery')},
    {icon: HandCoins, label: t('cod')},
    {icon: ShieldCheck, label: t('refund')}
  ];

  return (
    <div className="border-b bg-secondary text-secondary-foreground">
      <ul className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-1 px-4 py-2 text-xs font-medium sm:justify-between sm:gap-x-4">
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
