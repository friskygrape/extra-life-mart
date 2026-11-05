import { getProduct } from '../data/products';
import type { GameState } from './state';

export type Cart = Record<string, number>;

/** A same-day delivery costs this much more than waiting until morning. */
const RUSH_MARKUP = 1.25;

export function cartCost(cart: Cart): number {
  return Object.entries(cart).reduce((sum, [id, qty]) => sum + getProduct(id).wholesale * qty, 0);
}

export const rushCost = (cart: Cart) => Math.ceil(cartCost(cart) * RUSH_MARKUP);

function addTo(target: Record<string, number>, cart: Cart) {
  for (const [id, qty] of Object.entries(cart)) {
    if (qty > 0) target[id] = (target[id] ?? 0) + qty;
  }
}

/** Pays for a cart now. It comes tomorrow morning, or today for a rush. Returns false if you can't afford it. */
export function placeOrder(state: GameState, cart: Cart, rush = false): boolean {
  const cost = rush ? rushCost(cart) : cartCost(cart);
  if (cost <= 0 || cost > state.balance) return false;
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
