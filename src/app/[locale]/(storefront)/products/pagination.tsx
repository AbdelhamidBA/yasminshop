import {Link} from '@/i18n/navigation';
import {cn} from '@/lib/utils';

type PaginationProps = {
  page: number;
  totalPages: number;
  // Current (non-page) query params, preserved verbatim on every page link.
  params: Record<string, string>;
  prevLabel: string;
  nextLabel: string;
  // Letter-spacing breaks joined Arabic, so the caller gates the tracking.
  tracked?: boolean;
};

// Sync server component: pure prev/next + numbered Links, no hooks. Labels
// arrive as props (same idiom as ProductCard) so it stays hook-free.
//
// Set as the foot of a printed page: a dotted rule, utility-face prev/next,
// and the page you are on marked in gold — the same "where am I" accent the
// filter rail uses.
export function Pagination({
  page,
  totalPages,
  params,
  prevLabel,
  nextLabel,
  tracked = true
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const hrefFor = (target: number) => {
    const search = new URLSearchParams(params);
    if (target > 1) search.set('page', String(target));
    return `/products${search.size ? `?${search}` : ''}`;
  };

  const numbers = Array.from({length: totalPages}, (_, i) => i + 1);
  const focusRing =
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';
  const edgeClass = cn(
    'inline-flex h-9 items-center rounded-lg border px-4 text-[11px] font-semibold transition-colors',
    tracked && 'uppercase tracking-[0.14em]',
    focusRing
  );
  const numberClass = cn(
    'inline-flex size-9 items-center justify-center rounded-lg text-sm tabular-nums transition-colors',
    focusRing
  );

  return (
    <nav className="mt-10 flex flex-wrap items-center justify-center gap-1.5 border-t border-dotted pt-7">
      {page > 1 ? (
        <Link
          href={hrefFor(page - 1)}
          className={cn(edgeClass, 'hover:border-(--primary-deep) hover:text-(--brand-brown)')}
        >
          {prevLabel}
        </Link>
      ) : (
        <span
          aria-disabled="true"
          className={cn(edgeClass, 'border-dashed text-muted-foreground/60')}
        >
          {prevLabel}
        </span>
      )}
      {numbers.map((n) =>
        n === page ? (
          <span
            key={n}
            aria-current="page"
            className={cn(numberClass, 'bg-primary font-semibold text-primary-foreground')}
          >
            {n}
          </span>
        ) : (
          <Link
            key={n}
            href={hrefFor(n)}
            className={cn(
              numberClass,
              'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            {n}
          </Link>
        )
      )}
      {page < totalPages ? (
        <Link
          href={hrefFor(page + 1)}
          className={cn(edgeClass, 'hover:border-(--primary-deep) hover:text-(--brand-brown)')}
        >
          {nextLabel}
        </Link>
      ) : (
        <span
          aria-disabled="true"
          className={cn(edgeClass, 'border-dashed text-muted-foreground/60')}
        >
          {nextLabel}
        </span>
      )}
    </nav>
  );
}
