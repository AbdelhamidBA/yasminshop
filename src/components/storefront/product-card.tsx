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
      className="group flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md"
    >
      <div className="relative overflow-hidden bg-muted">
        {/* Plain <img>: uploads are served same-origin from /api/uploads. */}
        <img
          src={imageUrl}
          alt={name}
          loading="lazy"
          className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {product.quantity === 0 && (
          <span className="absolute start-3 top-3 rounded-full bg-background/90 px-2.5 py-0.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur">
            {outOfStockLabel}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="truncate text-sm font-medium group-hover:text-primary">{name}</h3>
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
