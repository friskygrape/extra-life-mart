import { PRODUCTS } from '../data/products';
import { slotsInRow } from '../data/shelves';

export interface ShelfState {
  id: string;
  productId: string | null;
  qty: number;
}

export interface DayStats {
  revenue: number;
  orderSpend: number;
  upgradeSpend: number;
  overpaid: number;
  missedSales: number;
  customersServed: number;
}

export interface GameState {
  version: number;
  day: number;
  balance: number;
  stockroom: Record<string, number>;
  pendingOrders: Record<string, number>;
  shelves: ShelfState[];
  rowsOwned: number;
  stats: DayStats;
  bestProfit: number | null;
  unlocked: string[];
}

export const SAVE_VERSION = 4;

export function emptyStats(): DayStats {
  return { revenue: 0, orderSpend: 0, upgradeSpend: 0, overpaid: 0, missedSales: 0, customersServed: 0 };
}

export function newShelf(id: string): ShelfState {
  return { id, productId: null, qty: 0 };
}

export function newGame(): GameState {
  return {
    version: SAVE_VERSION,
    day: 1,
    balance: 10000,
    stockroom: { chips: 12, soda: 12, choco: 12, noodle: 12 },
    pendingOrders: {},
    shelves: slotsInRow(0).map((s) => newShelf(s.id)),
    rowsOwned: 1,
    stats: emptyStats(),
    bestProfit: null,
    unlocked: PRODUCTS.filter((p) => !p.licence).map((p) => p.id),
  };
}
