import { PRODUCTS, getProduct, type Product } from '../data/products';
import type { GameState } from './state';

export function lockedProducts(state: GameState): Product[] {
  return PRODUCTS.filter((p) => !state.unlocked.includes(p.id)).sort((a, b) => (a.licence ?? 0) - (b.licence ?? 0));
}

export function unlockedProducts(state: GameState): Product[] {
  return PRODUCTS.filter((p) => state.unlocked.includes(p.id));
}

/** Pays for a licence and unlocks the product. Returns false if it's already unlocked or unaffordable. */
export function buyLicence(state: GameState, productId: string): boolean {
  const price = getProduct(productId).licence ?? 0;
  if (state.unlocked.includes(productId) || price > state.balance) return false;
  state.balance -= price;
  state.stats.licenceSpend += price;
  state.unlocked.push(productId);
  return true;
}
