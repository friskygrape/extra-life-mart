import { getProduct } from '../data/products';
import { roundToNickel } from './money';
import type { GameState } from './state';

/** What these items come to: cash rounds to the nickel. The till's display and the receipt both use this. */
export function saleTotal(items: string[], cash: boolean): number {
  const total = items.reduce((sum, id) => sum + getProduct(id).retail, 0);
  return cash ? roundToNickel(total) : total;
}

export type CashResult = { status: 'short'; missing: number } | { status: 'exact' } | { status: 'over'; extra: number };

/** Short change is refused; handing over too much goes through and costs the shop the difference. */
export function checkChange(total: number, tendered: number, given: number): CashResult {
  const due = tendered - total;
  if (given < due) return { status: 'short', missing: due - given };
  if (given === due) return { status: 'exact' };
  return { status: 'over', extra: given - due };
}

/** The card terminal must be keyed with the exact total; anything else is declined. */
export function checkCard(total: number, entered: number): boolean {
  return total === entered;
}

export function completeSale(state: GameState, total: number, overpaid: number, tip = 0): void {
  state.balance += total - overpaid + tip;
  state.stats.revenue += total;
  state.stats.tips += tip;
  state.stats.overpaid += overpaid;
  state.stats.customersServed += 1;
  state.totalServed += 1;
}
