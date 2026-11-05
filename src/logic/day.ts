import { unlockedProducts } from './licences';
import { emptyStats, type DayStats, type GameState } from './state';

export interface DaySummary extends DayStats {
  day: number;
  profit: number;
  balance: number;
  newBest: boolean;
}

export const STARTER_BOX: Record<string, number> = { chips: 5, soda: 5, choco: 5 };

export function dayProfit(stats: DayStats): number {
  return stats.revenue - stats.overpaid - stats.orderSpend;
}

function totalUnits(counts: Record<string, number>): number {
  return Object.values(counts).reduce((sum, n) => sum + n, 0);
}

/** If nothing can be sold or bought, the supplier sends a free box so the run can't get stuck. */
export function applyBrokeSafeguard(state: GameState): boolean {
  const onShelves = state.shelves.reduce((sum, s) => sum + s.qty, 0);
  const cheapest = Math.min(...unlockedProducts(state).map((p) => p.wholesale));
  const stuck =
    onShelves === 0 &&
    totalUnits(state.stockroom) === 0 &&
    totalUnits(state.pendingOrders) === 0 &&
    state.balance < cheapest;
  if (!stuck) return false;
  for (const [id, qty] of Object.entries(STARTER_BOX)) state.stockroom[id] = qty;
  return true;
}

export interface NextDayEvents {
  summary: DaySummary;
  starterBox: boolean;
}

/** Closes the books on today and sets up tomorrow. Undelivered orders stay on their way. */
export function endDay(state: GameState): NextDayEvents {
  const profit = dayProfit(state.stats);
  const newBest = profit > 0 && (state.bestProfit === null || profit > state.bestProfit);
  if (newBest) state.bestProfit = profit;
  const summary: DaySummary = { ...state.stats, day: state.day, profit, balance: state.balance, newBest };
  state.day += 1;
  state.stats = emptyStats();
  const starterBox = applyBrokeSafeguard(state);
  return { summary, starterBox };
}
