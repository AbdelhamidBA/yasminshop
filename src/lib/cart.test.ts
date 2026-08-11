import {describe, expect, test} from 'vitest';
import {cartCount, cartReducer, cartSubtotal, type CartItem, type CartState} from './cart';

function baseItem(overrides: Partial<Omit<CartItem, 'qty'>> = {}): Omit<CartItem, 'qty'> {
  return {
    productId: 'p1',
    slug: 'casque-audio',
    nameFr: 'Casque audio',
    nameAr: 'سماعة رأس',
    unitPriceMillimes: 9_990,
    imageUrl: '/api/uploads/products/seed-casque-audio.webp',
    ...overrides
  };
}

function stateWith(...items: CartItem[]): CartState {
  return {items};
}

describe('cartReducer', () => {
  test('add appends a new line with the given qty', () => {
    const next = cartReducer(stateWith(), {type: 'add', item: baseItem(), qty: 2});
    expect(next.items).toEqual([{...baseItem(), qty: 2}]);
  });

  test('add merges by productId and sums qty', () => {
    const start = stateWith(
      {...baseItem(), qty: 2},
      {...baseItem({productId: 'p2', slug: 'autre'}), qty: 1}
    );
    const next = cartReducer(start, {type: 'add', item: baseItem(), qty: 3});
    expect(next.items).toEqual([
      {...baseItem(), qty: 5},
      {...baseItem({productId: 'p2', slug: 'autre'}), qty: 1}
    ]);
  });

  test('add caps the merged qty at 99', () => {
    const start = stateWith({...baseItem(), qty: 97});
    const next = cartReducer(start, {type: 'add', item: baseItem(), qty: 10});
    expect(next.items).toEqual([{...baseItem(), qty: 99}]);
  });

  test('setQty updates the line, caps at 99, and qty ≤ 0 removes the line', () => {
    const start = stateWith({...baseItem(), qty: 2});
    expect(cartReducer(start, {type: 'setQty', productId: 'p1', qty: 7}).items).toEqual([
      {...baseItem(), qty: 7}
    ]);
    expect(cartReducer(start, {type: 'setQty', productId: 'p1', qty: 150}).items).toEqual([
      {...baseItem(), qty: 99}
    ]);
    expect(cartReducer(start, {type: 'setQty', productId: 'p1', qty: 0}).items).toEqual([]);
    expect(cartReducer(start, {type: 'setQty', productId: 'p1', qty: -3}).items).toEqual([]);
  });

  test('remove deletes only the matching line', () => {
    const start = stateWith(
      {...baseItem(), qty: 2},
      {...baseItem({productId: 'p2', slug: 'autre'}), qty: 1}
    );
    const next = cartReducer(start, {type: 'remove', productId: 'p1'});
    expect(next.items).toEqual([{...baseItem({productId: 'p2', slug: 'autre'}), qty: 1}]);
  });

  test('clear empties the cart', () => {
    const start = stateWith({...baseItem(), qty: 2}, {...baseItem({productId: 'p2'}), qty: 1});
    expect(cartReducer(start, {type: 'clear'})).toEqual({items: []});
  });
});

describe('cartCount / cartSubtotal', () => {
  test('count sums quantities and subtotal sums unitPrice × qty', () => {
    const state = stateWith(
      {...baseItem(), qty: 2},
      {...baseItem({productId: 'p2', unitPriceMillimes: 25_000}), qty: 3}
    );
    expect(cartCount(state)).toBe(5);
    expect(cartSubtotal(state)).toBe(2 * 9_990 + 3 * 25_000);
    expect(cartCount({items: []})).toBe(0);
    expect(cartSubtotal({items: []})).toBe(0);
  });
});
