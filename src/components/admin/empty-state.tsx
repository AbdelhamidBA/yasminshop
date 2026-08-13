import type {ReactNode} from 'react';
import {SearchX} from 'lucide-react';
import {cn} from '@/lib/utils';
import {IconBox} from './ui';

// Shared empty-state panel for the admin list tables (orders, products,
// clients, categories, promo-codes, sub-admins). Minimal-UI empty states are
// generous and centred rather than a bare sentence: a soft-tinted icon box, the
// caller's already-localized message as a real headline, and an optional
// action/description slot underneath. No data, no fabricated content.
export function AdminEmptyState({
  children,
  description,
  action,
  icon,
  className
}: {
  children: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex min-h-64 flex-col items-center justify-center gap-4 px-6 py-14 text-center',
        className
      )}
    >
      <IconBox tone="neutral" className="size-16 rounded-3xl">
        {icon ?? <SearchX className="size-7" />}
      </IconBox>
      <div className="flex flex-col gap-1">
        <p className="text-base font-semibold text-foreground">{children}</p>
        {description ? (
          <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
