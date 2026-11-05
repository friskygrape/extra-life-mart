import { getProduct } from '../data/products';
import type { GameState } from './state';

export type Cart = Record<string, number>;

export function cartCost(cart: Cart): number {
  return Object.entries(cart).reduce((sum, [id, qty]) => sum + getProduct(id).wholesale * qty, 0);
}

/** Pays for a cart now; the goods arrive in a delivery box. Returns false if you can't afford it. */
export function placeOrder(state: GameState, cart: Cart): boolean {
  const cost = cartCost(cart);
  if (cost <= 0 || cost > state.balance) return false;
  state.balance -= cost;
  state.stats.orderSpend += cost;
  for (const [id, qty] of Object.entries(cart)) {
    if (qty > 0) state.pendingOrders[id] = (state.pendingOrders[id] ?? 0) + qty;
  }
  return true;
}

export function deliverOrders(state: GameState): number {
  let delivered = 0;
  for (const [id, qty] of Object.entries(state.pendingOrders)) {
    state.stockroom[id] = (state.stockroom[id] ?? 0) + qty;
    delivered += qty;
  }
  state.pendingOrders = {};
  return delivered;
}
