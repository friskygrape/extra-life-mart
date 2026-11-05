import { PRODUCTS, getProduct, type Product } from '../data/products';
import { SHELF_ROW_PRICES, slotsInRow } from '../data/shelves';
import { newShelf, type GameState } from './state';

export function lockedProducts(state: GameState): Product[] {
  return PRODUCTS.filter((p) => !state.unlocked.includes(p.id));
}

export function unlockedProducts(state: GameState): Product[] {
  return PRODUCTS.filter((p) => state.unlocked.includes(p.id));
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
