// Order status engine (spec, Phase 4). Pure module — no IO; the admin orders
// actions apply the stock effects inside a transaction using these rules.
// Allowed transitions: PENDING→CONFIRMED, PENDING→CANCELED, CONFIRMED→DELIVERED,
// CONFIRMED→CANCELED. DELIVERED and CANCELED are terminal.
import type {OrderStatus} from '@prisma/client';

export type {OrderStatus};

export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELED'],
  CONFIRMED: ['DELIVERED', 'CANCELED'],
  DELIVERED: [],
  CANCELED: []
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export type StockDelta = 'decrement' | 'restock' | 'none';

// Stock effects: confirming takes stock (PENDING→CONFIRMED), canceling a
// confirmed order gives it back (CONFIRMED→CANCELED). PENDING→CANCELED never
// took stock and CONFIRMED→DELIVERED already did — both are 'none'.
export function stockDelta(from: OrderStatus, to: OrderStatus): StockDelta {
  if (from === 'PENDING' && to === 'CONFIRMED') return 'decrement';
  if (from === 'CONFIRMED' && to === 'CANCELED') return 'restock';
  return 'none';
}
