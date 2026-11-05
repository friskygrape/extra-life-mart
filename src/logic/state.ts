import { PRODUCTS } from '../data/products';
import { slotsInRow } from '../data/shelves';
import type { WeatherId } from '../data/weather';
import { START_REPUTATION } from './reputation';

export interface ShelfState {
  id: string;
  productId: string | null;
  qty: number;
}

export interface DayStats {
  revenue: number;
  tips: number;
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
  /** Ordered today, arriving tomorrow morning. */
  pendingOrders: Record<string, number>;
  /** Here now, waiting in a delivery box on the counter. */
  arrivals: Record<string, number>;
  shelves: ShelfState[];
  rowsOwned: number;
  stats: DayStats;
  bestProfit: number | null;
  unlocked: string[];
  weather: WeatherId;
  forecast: WeatherId;
  reputation: number;
  /** Rent missed last Sunday, added to this week's bill. */
  rentBehind: number;
  /** The store has closed for good: the game is over. */
  closed: boolean;
  totalServed: number;
}

export const SAVE_VERSION = 5;

export function emptyStats(): DayStats {
  return { revenue: 0, tips: 0, orderSpend: 0, upgradeSpend: 0, overpaid: 0, missedSales: 0, customersServed: 0 };
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
    arrivals: {},
    shelves: slotsInRow(0).map((s) => newShelf(s.id)),
    rowsOwned: 1,
    stats: emptyStats(),
    bestProfit: null,
    unlocked: PRODUCTS.filter((p) => !p.licence).map((p) => p.id),
    weather: 'sunny',
    // A clear first forecast, so the TV and soda demand teach themselves on day 2.
    forecast: 'heatwave',
    reputation: START_REPUTATION,
    rentBehind: 0,
    closed: false,
    totalServed: 0,
  };
}
