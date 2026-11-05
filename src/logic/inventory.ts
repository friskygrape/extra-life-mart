import { SHELF_CAPACITY } from '../data/products';
import type { GameState, ShelfState } from './state';

export type StockResult = 'ok' | 'shelf-taken' | 'shelf-full' | 'none-in-stock';

function getShelf(state: GameState, shelfId: string): ShelfState {
  const shelf = state.shelves.find((s) => s.id === shelfId);
  if (!shelf) throw new Error(`Unknown shelf: ${shelfId}`);
  return shelf;
}

/** Moves up to `qty` units from stock onto a shelf. Partial moves still return 'ok'. */
export function stockShelf(state: GameState, shelfId: string, productId: string, qty: number): StockResult {
  const shelf = getShelf(state, shelfId);
  if (shelf.productId && shelf.productId !== productId && shelf.qty > 0) return 'shelf-taken';
  const room = SHELF_CAPACITY - shelf.qty;
  if (room <= 0) return 'shelf-full';
  const available = state.stockroom[productId] ?? 0;
  if (available <= 0) return 'none-in-stock';
  const moved = Math.min(qty, room, available);
  state.stockroom[productId] = available - moved;
  shelf.productId = productId;
  shelf.qty += moved;
  return 'ok';
}

/** Returns everything on a shelf to stock so it can hold a different product. */
export function emptyShelf(state: GameState, shelfId: string): void {
  const shelf = getShelf(state, shelfId);
  if (shelf.productId && shelf.qty > 0) {
    state.stockroom[shelf.productId] = (state.stockroom[shelf.productId] ?? 0) + shelf.qty;
  }
  shelf.productId = null;
  shelf.qty = 0;
}

export function anyShelfStocked(state: GameState): boolean {
  return state.shelves.some((s) => s.qty > 0);
}

/** Moves one unit from a shelf to the table. Returns false if that shelf has run out. */
export function takeFromShelf(state: GameState, shelfId: string, productId: string): boolean {
  const shelf = getShelf(state, shelfId);
  if (shelf.productId !== productId || shelf.qty <= 0) return false;
  shelf.qty -= 1;
  if (shelf.qty === 0) shelf.productId = null;
  return true;
}

/** Puts one unit back: on a shelf already holding it, else an empty shelf, else in stock. */
export function returnItem(state: GameState, productId: string): void {
  const shelf =
    state.shelves.find((s) => s.productId === productId && s.qty < SHELF_CAPACITY) ??
    state.shelves.find((s) => s.qty === 0);
  if (!shelf) {
    state.stockroom[productId] = (state.stockroom[productId] ?? 0) + 1;
    return;
  }
  shelf.productId = productId;
  shelf.qty += 1;
}
