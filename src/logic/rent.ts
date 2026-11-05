import { weekOf } from './calendar';
import type { GameState } from './state';

/** Rent for the first weeks. After these it rises by a step each week, up to the cap. */
const OPENING_RENTS = [5000, 10000, 15000, 20000];
const RENT_STEP = 2500;
const RENT_CAP = 40000;

export function weeklyRent(week: number): number {
  const opening = OPENING_RENTS[week - 1];
  if (opening !== undefined) return opening;
  const last = OPENING_RENTS[OPENING_RENTS.length - 1];
  return Math.min(RENT_CAP, last + RENT_STEP * (week - OPENING_RENTS.length));
}

/** What the coming Sunday will cost: this week's rent, plus last week's if it was missed. */
export function rentDue(state: GameState): number {
  return weeklyRent(weekOf(state.day)) + state.rentBehind;
}

export type RentResult =
  | { status: 'paid'; amount: number }
  /** Nothing was taken. The missed rent is added to next week's bill. */
  | { status: 'missed'; amount: number; owedNext: number }
  /** A second miss in a row: the store closes and the game is over. */
  | { status: 'closed'; amount: number };

export function settleRent(state: GameState): RentResult {
  const amount = rentDue(state);
  if (state.balance >= amount) {
    state.balance -= amount;
    state.rentBehind = 0;
    return { status: 'paid', amount };
  }
  if (state.rentBehind > 0) {
    state.closed = true;
    return { status: 'closed', amount };
  }
  state.rentBehind = amount;
  return { status: 'missed', amount, owedNext: amount + weeklyRent(weekOf(state.day) + 1) };
}
