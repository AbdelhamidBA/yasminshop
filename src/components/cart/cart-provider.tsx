'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode
} from 'react';
import {cartReducer, MAX_QTY, type CartAction, type CartItem, type CartState} from '@/lib/cart';

// localStorage cart (no DB cart). IMPORTANT: unitPriceMillimes stored here is
// DISPLAY ONLY — checkout ignores client prices and re-prices every line
// server-side from the DB before creating the order.

const STORAGE_KEY = 'cart-v1';

// Upper bound on how many distinct lines a persisted cart may revive into
// memory — defensive cap against a tampered/oversized localStorage payload.
const MAX_REVIVED_ITEMS = 200;

type CartContextValue = {
  state: CartState;
  // False until the localStorage read has run on the client; consumers that
  // render count-dependent UI wait for it to avoid a hydration mismatch.
  hydrated: boolean;
  add: (item: Omit<CartItem, 'qty'>, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  // Cart side-drawer UI state (Phase 7). Session-only (never persisted):
  // opened by the header/bottom-nav cart buttons and after add-to-cart,
  // rendered by <CartDrawer> in the storefront layout.
  drawerOpen: boolean;
  openDrawer: () => void;
  setDrawerOpen: (open: boolean) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

// Hydration replaces the whole state; every other transition goes through the
// pure, unit-tested reducer.
type ProviderAction = CartAction | {type: 'hydrate'; state: CartState};

function providerReducer(state: CartState, action: ProviderAction): CartState {
  if (action.type === 'hydrate') return action.state;
  return cartReducer(state, action);
}

// Guarded revival of the persisted payload: anything that is not a
// well-formed cart line is dropped (invalid JSON → empty cart).
function reviveStoredState(raw: string): CartState {
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null) return {items: []};
  const items = (parsed as {items?: unknown}).items;
  if (!Array.isArray(items)) return {items: []};
  const revived: CartItem[] = [];
  for (const entry of items) {
    // Cap the number of revived lines: a tampered/bloated localStorage payload
    // must not be able to hydrate an unbounded cart into memory.
    if (revived.length >= MAX_REVIVED_ITEMS) break;
    if (typeof entry !== 'object' || entry === null) continue;
    const line = entry as Record<string, unknown>;
    if (
      typeof line.productId !== 'string' ||
      line.productId === '' ||
      typeof line.slug !== 'string' ||
      typeof line.nameFr !== 'string' ||
      typeof line.nameAr !== 'string' ||
      // Price is millimes (integer minor unit) and can never be negative —
      // reject non-integer/negative values rather than reviving a corrupt line.
      typeof line.unitPriceMillimes !== 'number' ||
      !Number.isInteger(line.unitPriceMillimes) ||
      line.unitPriceMillimes < 0 ||
      !(typeof line.imageUrl === 'string' || line.imageUrl === null) ||
      typeof line.qty !== 'number' ||
      !Number.isInteger(line.qty) ||
      line.qty < 1 ||
      revived.some((existing) => existing.productId === line.productId)
    ) {
      continue;
    }
    revived.push({
      productId: line.productId,
      slug: line.slug,
      nameFr: line.nameFr,
      nameAr: line.nameAr,
      unitPriceMillimes: line.unitPriceMillimes,
      imageUrl: line.imageUrl,
      qty: Math.min(line.qty, MAX_QTY)
    });
  }
  return {items: revived};
}

export function CartProvider({children}: {children: ReactNode}) {
  const [state, dispatch] = useReducer(providerReducer, {items: []});
  const [hydrated, setHydrated] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Hydrate once on mount (client only — the server always renders an empty,
  // not-yet-hydrated cart).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw !== null) {
        dispatch({type: 'hydrate', state: reviveStoredState(raw)});
      }
    } catch {
      // Corrupt JSON or storage unavailable → keep the empty cart.
    }
    setHydrated(true);
  }, []);

  // Persist on change — only after hydration, so the initial empty state
  // never overwrites a stored cart.
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage full or unavailable — the in-memory cart still works.
    }
  }, [state, hydrated]);

  const add = useCallback(
    (item: Omit<CartItem, 'qty'>, qty = 1) => dispatch({type: 'add', item, qty}),
    []
  );
  const setQty = useCallback(
    (productId: string, qty: number) => dispatch({type: 'setQty', productId, qty}),
    []
  );
  const remove = useCallback((productId: string) => dispatch({type: 'remove', productId}), []);
  const clear = useCallback(() => dispatch({type: 'clear'}), []);
  const openDrawer = useCallback(() => setDrawerOpen(true), []);

  const value = useMemo(
    () => ({state, hydrated, add, setQty, remove, clear, drawerOpen, openDrawer, setDrawerOpen}),
    [state, hydrated, add, setQty, remove, clear, drawerOpen, openDrawer]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (context === null) {
    throw new Error('useCart must be used within <CartProvider>');
  }
  return context;
}
