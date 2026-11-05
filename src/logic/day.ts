import { BOX_SIZE } from '../data/products';
import { rollWeather } from '../data/weather';
import { isRentDay } from './calendar';
import { unlockedProducts } from './licences';
import { receiveOvernight } from './orders';
import { settleRent, type RentResult } from './rent';
import { emptyStats, type DayStats, type GameState } from './state';

export interface DaySummary extends DayStats {
  day: number;
  profit: number;
  balance: number;
  newBest: boolean;
  /** Set on Sundays, when rent comes out. */
  rent: RentResult | null;
}

export const STARTER_BOX: Record<string, number> = { chips: 5, soda: 5, choco: 5 };

export function dayProfit(stats: DayStats): number {
  return stats.revenue + stats.tips - stats.overpaid - stats.orderSpend;
}

function totalUnits(counts: Record<string, number>): number {
  return Object.values(counts).reduce((sum, n) => sum + n, 0);
}

/** Nothing on the shelves and nothing on hand to put there, so there's no point opening today. */
export function nothingToSell(state: GameState): boolean {
  return state.shelves.every((s) => s.qty === 0) && totalUnits(state.stockroom) === 0 && totalUnits(state.arrivals) === 0;
}

/** If nothing can be sold or bought, the supplier sends a free box so the run can't get stuck. */
export function applyBrokeSafeguard(state: GameState): boolean {
  // Stock only comes by the box, so the cheapest box is the least you can spend.
  const cheapest = Math.min(...unlockedProducts(state).map((p) => p.wholesale)) * BOX_SIZE;
  const stuck = nothingToSell(state) && totalUnits(state.pendingOrders) === 0 && state.balance < cheapest;
  if (!stuck) return false;
  for (const [id, qty] of Object.entries(STARTER_BOX)) state.stockroom[id] = qty;
  return true;
}

export interface NextDayEvents {
  summary: DaySummary;
  starterBox: boolean;
}

/** Closes the books on today and sets up tomorrow: rent on Sundays, overnight deliveries and new weather. */
export function endDay(state: GameState, rng: () => number = Math.random): NextDayEvents {
  const profit = dayProfit(state.stats);
  const newBest = profit > 0 && (state.bestProfit === null || profit > state.bestProfit);
  if (newBest) state.bestProfit = profit;
  const rent = isRentDay(state.day) ? settleRent(state) : null;
  const summary: DaySummary = { ...state.stats, day: state.day, profit, balance: state.balance, newBest, rent };
  state.day += 1;
  state.stats = emptyStats();
  receiveOvernight(state);
  state.weather = state.forecast;
  state.forecast = rollWeather(state.weather, rng);
  const starterBox = applyBrokeSafeguard(state);
  return { summary, starterBox };
}
