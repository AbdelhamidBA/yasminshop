import {Link} from '@/i18n/navigation';
import {Price} from '@/components/storefront/price';
import {QuickAddButton} from '@/components/storefront/quick-add-button';
import {effectivePriceMillimes} from '@/lib/money';
import type {ProductCardData} from '@/server/storefront';

type ProductCardProps = {
  product: ProductCardData;
  locale: string;
  massDiscountPct: number | null;
  currencyLabel: string;
  outOfStockLabel: string;
};

// Server-compatible card (no hooks itself): locale and labels arrive as props
// so it stays usable from any server page; the quick-add control at the
// bottom is a nested CLIENT component.
//
// Phase 8 yasmine redesign (spec §11/§14/§15): white card surface (bg-card),
// image on the cream token backdrop (bg-background), price in deep brown
// (--brand-brown), subtle border + minimal shadow, hover = slight image scale
// + very subtle elevation (no lift/translate). NO star ratings and NO
// wishlist heart — neither has a data model; rendering them would fabricate
// data (binding honesty ruling over the brief's card mockup).
//
// Structure: the card root is a <div>; image + name + price are wrapped in
// the product Link while the quick-add <button> is a SIBLING — a <button>
// nested inside an <a> would be invalid HTML and break both semantics and
// the e2e locator surfaces.
export function ProductCard({
  product,
  locale,
  massDiscountPct,
  currencyLabel,
  outOfStockLabel
}: ProductCardProps) {
  const name = locale === 'ar' ? product.nameAr : product.nameFr;
  const imageUrl = product.images[0]?.url ?? '/placeholder-product.svg';
  const outOfStock = product.quantity === 0;
  // Cart line price is the EFFECTIVE price (mass-discount-aware) — display
  // only; checkout re-prices server-side.
  const effective = effectivePriceMillimes(
    product.priceMillimes,
    product.discountPct,
    massDiscountPct
  );

  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-lg border bg-card shadow-xs transition-shadow duration-300 hover:shadow-md">
      <Link href={`/products/${product.slug}`} className="flex flex-1 flex-col">
        <div className="relative overflow-hidden bg-background">
          {/* Plain <img>: uploads are served same-origin from /api/uploads. */}
          <img
            src={imageUrl}
            alt={name}
            loading="lazy"
            className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
          {outOfStock && (
            <span className="absolute start-3 top-3 rounded-md bg-background/90 px-2.5 py-0.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur">
              {outOfStockLabel}
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1 px-3 pt-3 sm:px-4">
          {/* Two lines, not one: real product names here run long ("Shampooing
              très doux 2 en 1 DOP") and a single truncated line hides the part
              that distinguishes one variant from another. Prices stay aligned
              across the row because the price block keeps mt-auto. */}
          <h3 className="line-clamp-2 text-sm leading-snug font-medium transition-colors group-hover:text-primary">
            {name}
          </h3>
          {/* Deep-brown price (spec §11); Price keeps its own muted
              strikethrough + destructive -N% badge for discounts. */}
          <div className="mt-auto text-(--brand-brown)">
            <Price
              priceMillimes={product.priceMillimes}
              discountPct={product.discountPct}
              massDiscountPct={massDiscountPct}
              currencyLabel={currencyLabel}
            />
          </div>
        </div>
      </Link>
      <div className="px-3 pt-2.5 pb-3 sm:px-4">
        <QuickAddButton
          productId={product.id}
          slug={product.slug}
          nameFr={product.nameFr}
          nameAr={product.nameAr}
          name={name}
          unitPriceMillimes={effective}
          imageUrl={product.images[0]?.url ?? null}
          outOfStock={outOfStock}
        />
      </div>
    </div>
  );
}
