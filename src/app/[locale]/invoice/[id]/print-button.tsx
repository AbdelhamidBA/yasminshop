'use client';

import {Printer} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {Button} from '@/components/ui/button';

// Client leaf: the only interactive piece of the invoice page. Hidden when
// printing (print:hidden on the button itself, belt-and-braces with the
// wrapper bar on the page).
export function PrintButton() {
  const t = useTranslations('invoice');

  return (
    <Button type="button" className="print:hidden" onClick={() => window.print()}>
      <Printer className="size-4" /> {t('print')}
    </Button>
  );
}
