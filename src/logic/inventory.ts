import { getProduct, SHELF_CAPACITY } from '../data/products';
import type { GameState, ShelfState } from './state';

export type StockResult = 'ok' | 'wrong-kind' | 'shelf-taken' | 'shelf-full' | 'none-in-stock';

function getShelf(state: GameState, shelfId: string): ShelfState {
  const shelf = state.shelves.find((s) => s.id === shelfId);
  if (!shelf) throw new Error(`Unknown shelf: ${shelfId}`);
  return shelf;
}

/** Moves up to `qty` units from the stockroom onto a shelf. Partial moves still return 'ok'. */
export function stockShelf(state: GameState, shelfId: string, productId: string, qty: number): StockResult {
  const shelf = getShelf(state, shelfId);
  if (getProduct(productId).kind !== shelf.kind) return 'wrong-kind';
  if (shelf.productId && shelf.productId !== productId && shelf.qty > 0) return 'shelf-taken';
  const room = SHELF_CAPACITY[shelf.kind] - shelf.qty;
  if (room <= 0) return 'shelf-full';
  const available = state.stockroom[productId] ?? 0;
  if (available <= 0) return 'none-in-stock';
  const moved = Math.min(qty, room, available);
  state.stockroom[productId] = available - moved;
  shelf.productId = productId;
  shelf.qty += moved;
  return 'ok';
}

/** Returns everything on a shelf to the stockroom so it can hold a different product. */
export function emptyShelf(state: GameState, shelfId: string): void {
  const shelf = getShelf(state, shelfId);
  if (shelf.productId && shelf.qty > 0) {
    state.stockroom[shelf.productId] = (state.stockroom[shelf.productId] ?? 0) + shelf.qty;
  }
  shelf.productId = null;
  shelf.qty = 0;
}

export function findShelfWith(state: GameState, productId: string): ShelfState | null {
  return state.shelves.find((s) => s.productId === productId && s.qty > 0) ?? null;
}

/** A customer takes one unit. Returns false if that shelf has run out. */
export function takeFromShelf(state: GameState, shelfId: string, productId: string): boolean {
  const shelf = getShelf(state, shelfId);
  if (shelf.productId !== productId || shelf.qty <= 0) return false;
  shelf.qty -= 1;
  if (shelf.qty === 0) shelf.productId = null;
  return true;
}
