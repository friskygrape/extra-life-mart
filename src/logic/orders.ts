import { getProduct } from '../data/products';
import type { GameState } from './state';

export type Cart = Record<string, number>;

/** Tomorrow's delivery is free. A same-day delivery is this flat fee, however much you order. */
export const RUSH_FEE = 2000;

export function cartCost(cart: Cart): number {
  return Object.entries(cart).reduce((sum, [id, qty]) => sum + getProduct(id).wholesale * qty, 0);
}

export const rushCost = (cart: Cart) => cartCost(cart) + RUSH_FEE;

function addTo(target: Record<string, number>, cart: Cart) {
  for (const [id, qty] of Object.entries(cart)) {
    if (qty > 0) target[id] = (target[id] ?? 0) + qty;
  }
}

/** Pays for a cart now. It comes tomorrow morning, or today for a rush. Returns false if you can't afford it. */
export function placeOrder(state: GameState, cart: Cart, rush = false): boolean {
  if (cartCost(cart) <= 0) return false;
  const cost = rush ? rushCost(cart) : cartCost(cart);
  if (cost > state.balance) return false;
  state.balance -= cost;
  state.stats.orderSpend += cost;
  addTo(rush ? state.arrivals : state.pendingOrders, cart);
  return true;
}

/** Overnight, yesterday's orders reach the counter. */
export function receiveOvernight(state: GameState): void {
  addTo(state.arrivals, state.pendingOrders);
  state.pendingOrders = {};
}

/** Unpacks the box on the counter into your stock. */
export function deliverOrders(state: GameState): number {
  let delivered = 0;
  for (const [id, qty] of Object.entries(state.arrivals)) {
    state.stockroom[id] = (state.stockroom[id] ?? 0) + qty;
    delivered += qty;
  }
  state.arrivals = {};
  return delivered;
}
