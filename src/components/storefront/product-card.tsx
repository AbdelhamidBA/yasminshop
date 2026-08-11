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
      className="group flex flex-col rounded-lg border bg-card p-3 transition-colors hover:border-foreground/20"
    >
      <div className="relative">
        {/* Plain <img>: uploads are served same-origin from /api/uploads. */}
        <img
          src={imageUrl}
          alt={name}
          loading="lazy"
          className="aspect-square w-full rounded-lg object-cover"
        />
        {product.quantity === 0 && (
          <span className="absolute start-2 top-2 rounded-md bg-background/90 px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {outOfStockLabel}
          </span>
        )}
      </div>
      <h3 className="mt-3 truncate text-sm font-medium group-hover:underline">{name}</h3>
      <div className="mt-1">
        <Price
          priceMillimes={product.priceMillimes}
          discountPct={product.discountPct}
          massDiscountPct={massDiscountPct}
          currencyLabel={currencyLabel}
        />
      </div>
    </Link>
  );
}
