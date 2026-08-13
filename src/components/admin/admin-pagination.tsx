import {Link} from '@/i18n/navigation';
import {cn} from '@/lib/utils';

// Shared admin pagination (Task 3 review carry-forward: the storefront
// Pagination idiom was copied for orders and a third copy was incoming for
// clients — extracted here instead). Sync server component, hook-free; the
// base path and labels arrive as props so every admin list can reuse it. The
// storefront Pagination stays untouched by design (it renders locale-aware
// catalog URLs and is owned by the storefront surface).
//
// Minimal-UI presentation: quiet. No borders — the controls are muted ghosts
// that tint on hover, and only the current page is filled with the primary
// token. Every interactive item keeps a visible focus ring.
export function AdminPagination({
  basePath,
  page,
  totalPages,
  params,
  prevLabel,
  nextLabel
}: {
  // Locale-less admin path, e.g. '/admin/orders' — i18n Link adds the locale.
  basePath: string;
  page: number;
  totalPages: number;
  // Current (non-page) query params, preserved verbatim on every page link.
  params: Record<string, string>;
  prevLabel: string;
  nextLabel: string;
}) {
  if (totalPages <= 1) return null;

  const hrefFor = (target: number) => {
    const search = new URLSearchParams(params);
    if (target > 1) search.set('page', String(target));
    return `${basePath}${search.size ? `?${search}` : ''}`;
  };

  const numbers = Array.from({length: totalPages}, (_, i) => i + 1);
  const focus = 'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';
  const edgeClass = cn(
    'inline-flex h-8 items-center rounded-lg px-3 text-sm font-semibold transition-colors',
    focus
  );
  const numberClass = cn(
    'inline-flex size-8 items-center justify-center rounded-lg text-sm font-semibold transition-colors',
    focus
  );

  return (
    <nav className="flex flex-wrap items-center justify-end gap-1">
      {page > 1 ? (
        <Link
          href={hrefFor(page - 1)}
          className={cn(edgeClass, 'text-muted-foreground hover:bg-muted hover:text-foreground')}
        >
          {prevLabel}
        </Link>
      ) : (
        <span aria-disabled="true" className={cn(edgeClass, 'text-muted-foreground opacity-40')}>
          {prevLabel}
        </span>
      )}
      {numbers.map((n) =>
        n === page ? (
          <span
            key={n}
            aria-current="page"
            className={cn(numberClass, 'bg-primary text-primary-foreground')}
          >
            {n}
          </span>
        ) : (
          <Link
            key={n}
            href={hrefFor(n)}
            className={cn(numberClass, 'text-muted-foreground hover:bg-muted hover:text-foreground')}
          >
            {n}
          </Link>
        )
      )}
      {page < totalPages ? (
        <Link
          href={hrefFor(page + 1)}
          className={cn(edgeClass, 'text-muted-foreground hover:bg-muted hover:text-foreground')}
        >
          {nextLabel}
        </Link>
      ) : (
        <span aria-disabled="true" className={cn(edgeClass, 'text-muted-foreground opacity-40')}>
          {nextLabel}
        </span>
      )}
    </nav>
  );
}
