import {Link} from '@/i18n/navigation';
import {Price} from '@/components/storefront/price';
import type {ProductCardData} from '@/server/storefront';

type ProductCardProps = {
  product: ProductCardData;
  locale: string;
  massDiscountPct: number | null;
  currencyLabel: string;
  outOfStockLabel: string;
};

// Sync server component (no hooks): locale and labels arrive as props so the
// card stays a pure presentational function usable from any server page.
//
// Phase 7 karina-soft restyle: rounded-2xl shell, image inset in a muted
// pastel frame (token-based, dark-safe), gentle hover lift + zoom, prominent
// price. No micro category label: ProductCardData deliberately carries no
// category (the card select stays narrow), and widening queries for a label
// is out of scope. h-full keeps cards equal-height inside carousel slides.
export function ProductCard({
  product,
  locale,
  massDiscountPct,
  currencyLabel,
  outOfStockLabel
}: ProductCardProps) {
  const name = locale === 'ar' ? product.nameAr : product.nameFr;
  const imageUrl = product.images[0]?.url ?? '/placeholder-product.svg';

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/25 hover:shadow-lg"
    >
      <div className="relative m-2 overflow-hidden rounded-xl bg-gradient-to-br from-muted/90 to-muted/40">
        {/* Plain <img>: uploads are served same-origin from /api/uploads. */}
        <img
          src={imageUrl}
          alt={name}
          loading="lazy"
          className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
        {product.quantity === 0 && (
          <span className="absolute start-3 top-3 rounded-full bg-background/90 px-2.5 py-0.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur">
            {outOfStockLabel}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 px-4 pb-4 pt-1.5">
        <h3 className="truncate text-sm font-medium transition-colors group-hover:text-primary">
          {name}
        </h3>
        <div className="mt-auto text-base">
          <Price
            priceMillimes={product.priceMillimes}
            discountPct={product.discountPct}
            massDiscountPct={massDiscountPct}
            currencyLabel={currencyLabel}
          />
        </div>
      </div>
    </Link>
  );
}
