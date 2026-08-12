import {Link} from '@/i18n/navigation';
import {cn} from '@/lib/utils';

type SectionHeaderProps = {
  title: string;
  href: string;
  linkLabel: string;
  // Uppercase + letter-spacing is FR-only (spec §12 editorial titles):
  // tracking breaks the joined Arabic script, so AR keeps the plain title.
  uppercase: boolean;
};

// Unified section header (spec §12): editorial uppercase title (not
// oversized), gold "Voir tout" link with a subtle underline animation
// (deep-gold on hover) and a subtle full-width bottom separator.
export function SectionHeader({title, href, linkLabel, uppercase}: SectionHeaderProps) {
  return (
    <div className="mb-6 flex items-baseline justify-between gap-4 border-b pb-3">
      <h2
        className={cn(
          'text-lg font-semibold sm:text-xl',
          uppercase && 'uppercase tracking-[0.14em]'
        )}
      >
        {title}
      </h2>
      <Link
        href={href}
        className="relative shrink-0 text-sm font-medium text-primary transition-colors after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:scale-x-0 after:bg-current after:transition-transform after:duration-300 hover:text-(--primary-deep) hover:after:scale-x-100 focus-visible:after:scale-x-100"
      >
        {linkLabel}
      </Link>
    </div>
  );
}
