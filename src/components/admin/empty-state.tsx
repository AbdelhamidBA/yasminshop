import type {ReactNode} from 'react';
import {cn} from '@/lib/utils';

// Shared empty-state panel for the admin list tables (Phase 6 consistency pass).
// A calm, centred dashed block so an empty orders/products/clients/categories/
// promo-codes/sub-admins view reads as intentional rather than broken. Callers
// pass the already-localized message as children; no data, no fabricated content.
export function AdminEmptyState({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex min-h-40 flex-col items-center justify-center gap-1 rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground',
        className
      )}
    >
      {children}
    </div>
  );
}
