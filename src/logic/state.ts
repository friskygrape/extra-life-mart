import { SHELF_SLOTS } from '../data/shelves';
import { PRODUCTS, type ProductKind } from '../data/products';

export interface ShelfState {
  id: string;
  kind: ProductKind;
  productId: string | null;
  qty: number;
}

export interface DayStats {
  revenue: number;
  orderSpend: number;
  licenceSpend: number;
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
  stats: DayStats;
  bestProfit: number | null;
  unlocked: string[];
}

export const SAVE_VERSION = 3;

export function emptyStats(): DayStats {
  return { revenue: 0, orderSpend: 0, licenceSpend: 0, overpaid: 0, missedSales: 0, customersServed: 0 };
}

export function newGame(): GameState {
  return {
    version: SAVE_VERSION,
    day: 1,
    balance: 20000,
    stockroom: { chips: 10, soda: 10, choco: 8, noodle: 6, golf: 2, mops: 2 },
    pendingOrders: {},
    shelves: SHELF_SLOTS.map((s) => ({ id: s.id, kind: s.kind, productId: null, qty: 0 })),
    stats: emptyStats(),
    bestProfit: null,
    unlocked: PRODUCTS.filter((p) => !p.licence).map((p) => p.id),
  };
}
