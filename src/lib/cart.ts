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
  imageUrl: string | null;
  qty: number;
};

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

export function cartSubtotal(state: CartState): number {
  return state.items.reduce((sum, line) => sum + line.unitPriceMillimes * line.qty, 0);
}
