import 'server-only';
import {DEFAULT_PAGE_SIZE} from '@/lib/pagination';

// Server-side backstop for the URL-sourced page/pageSize every admin listing
// takes. `src/lib/pagination.ts` already sanitises the query string, but the
// data layer must never trust its caller either: this is the single place that
// turns a (page, pageSize) pair into Prisma's skip/take, so an absurd offset or
// an unbounded `take` cannot reach Postgres from any listing.

// Keeps skip = (page - 1) * pageSize from producing absurd Postgres offsets.
const MAX_PAGE = 10_000;

// Upper bound on `take` — the rows-per-page control offers at most 100.
const MAX_PAGE_SIZE = 100;

export function pagingArgs({page, pageSize}: {page: number; pageSize: number}) {
  const safePage = Number.isSafeInteger(page) && page >= 1 && page <= MAX_PAGE ? page : 1;
  const safePageSize =
    Number.isInteger(pageSize) && pageSize >= 1 && pageSize <= MAX_PAGE_SIZE
      ? pageSize
      : DEFAULT_PAGE_SIZE;
  return {skip: (safePage - 1) * safePageSize, take: safePageSize};
}
