import { PRODUCTS, getProduct, type Product } from '../data/products';
import { SHELF_ROW_PRICES, slotsInRow } from '../data/shelves';
import { newShelf, type GameState } from './state';

/** Shelf products still waiting for a licence. Drinks and ingredients come with their appliances instead. */
export function lockedProducts(state: GameState): Product[] {
  return PRODUCTS.filter((p) => p.kind === 'shelf' && !state.unlocked.includes(p.id));
}

/** Shelf products you can stock and sell. */
export function unlockedProducts(state: GameState): Product[] {
  return PRODUCTS.filter((p) => p.kind === 'shelf' && state.unlocked.includes(p.id));
}

/** What you can order from the computer: unlocked shelf products and ingredients. */
export function orderableProducts(state: GameState): Product[] {
  return PRODUCTS.filter((p) => p.kind !== 'drink' && state.unlocked.includes(p.id));
}

/** Everything customers might ask for: unlocked shelf products and drinks. */
export function sellableIds(state: GameState): string[] {
  return PRODUCTS.filter((p) => p.kind !== 'ingredient' && state.unlocked.includes(p.id)).map((p) => p.id);
}

/** Pays for a licence and unlocks the product. Returns false if it's already unlocked or unaffordable. */
export function buyLicence(state: GameState, productId: string): boolean {
  const price = getProduct(productId).licence ?? 0;
  if (state.unlocked.includes(productId) || price > state.balance) return false;
  state.balance -= price;
  state.stats.upgradeSpend += price;
  state.unlocked.push(productId);
  return true;
}

/** The price of the next row of shelves, or null once you own them all. */
export function nextRowPrice(state: GameState): number | null {
  return SHELF_ROW_PRICES[state.rowsOwned - 1] ?? null;
}

export function buyShelfRow(state: GameState): boolean {
  const price = nextRowPrice(state);
  if (price === null || price > state.balance) return false;
  state.balance -= price;
  state.stats.upgradeSpend += price;
  state.shelves.push(...slotsInRow(state.rowsOwned).map((s) => newShelf(s.id)));
  state.rowsOwned += 1;
  return true;
}
