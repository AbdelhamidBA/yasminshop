// Pure client-cart reducer. No storage, no React — the CartProvider owns those.
// NOTE: unitPriceMillimes held in the cart is DISPLAY ONLY; checkout re-prices
// every line server-side from the DB (client prices are ignored).

export const MAX_QTY = 99;

export type CartItem = {
  productId: string;
  slug: string;
  nameFr: string;
  nameAr: string;
  unitPriceMillimes: number;
  // Wholesale, carried so the CART can show the bulk price as the quantity
  // changes. Display only, like unitPriceMillimes: createOrderCore re-reads
  // both from the database and re-tests the threshold against the qty it
  // accepted, so a tampered localStorage buys nothing.
  //
  // OPTIONAL on the type because carts persisted before this feature exist in
  // real browsers and must keep working — an absent field simply means "no
  // wholesale", which is also the correct answer for most products.
  wholesalePriceMillimes?: number | null;
  wholesaleMinQty?: number | null;
  imageUrl: string | null;
  qty: number;
};

/**
 * What one unit of this line costs at its current quantity. The cart's own
 * view of the pricing rule in src/lib/money.ts — the server owns the real
 * decision, this keeps the displayed total honest while the shopper edits.
 */
export function cartLineUnitPrice(line: CartItem, defaultMinQty: number): number {
  const wholesale = line.wholesalePriceMillimes ?? null;
  if (wholesale === null) return line.unitPriceMillimes;
  const threshold = line.wholesaleMinQty ?? defaultMinQty;
  if (!Number.isInteger(threshold) || threshold < 2 || line.qty < threshold) {
    return line.unitPriceMillimes;
  }
  // Never more than the price the shopper was already being shown.
  return Math.min(line.unitPriceMillimes, wholesale);
}

export type CartState = {items: CartItem[]};

export type CartAction =
  | {type: 'add'; item: Omit<CartItem, 'qty'>; qty: number}
  | {type: 'setQty'; productId: string; qty: number}
  | {type: 'remove'; productId: string}
  | {type: 'clear'};

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'add': {
      const existing = state.items.find((line) => line.productId === action.item.productId);
      if (existing) {
        return {
          items: state.items.map((line) =>
            line.productId === action.item.productId
              ? {...line, qty: Math.min(line.qty + action.qty, MAX_QTY)}
              : line
          )
        };
      }
      return {items: [...state.items, {...action.item, qty: Math.min(action.qty, MAX_QTY)}]};
    }
    case 'setQty': {
      if (action.qty <= 0) {
        return {items: state.items.filter((line) => line.productId !== action.productId)};
      }
      return {
        items: state.items.map((line) =>
          line.productId === action.productId
            ? {...line, qty: Math.min(action.qty, MAX_QTY)}
            : line
        )
      };
    }
    case 'remove':
      return {items: state.items.filter((line) => line.productId !== action.productId)};
    case 'clear':
      return {items: []};
  }
}

export function cartCount(state: CartState): number {
  return state.items.reduce((sum, line) => sum + line.qty, 0);
}

/**
 * Subtotal at the CURRENT quantities, wholesale included.
 *
 * defaultMinQty is required rather than defaulted: every caller has the shop
 * parameters to hand, and a silent default here would be a silently wrong
 * total on whichever screen forgot to pass it.
 */
export function cartSubtotal(state: CartState, defaultMinQty: number): number {
  return state.items.reduce(
    (sum, line) => sum + cartLineUnitPrice(line, defaultMinQty) * line.qty,
    0
  );
}
