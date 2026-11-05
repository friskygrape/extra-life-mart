import { roundToNickel } from './money';
import type { GameState } from './state';

/** Midway through two stars, so one small slip doesn't cost a star straight away. */
export const START_REPUTATION = 50;
const MAX_REPUTATION = 100;
const POINTS_PER_STAR = 20;
export const MAX_STARS = 5;

export type ServiceRating = 'great' | 'good' | 'ok' | 'slow';

/** Seconds that count as great service for an order of this size. */
export const greatServiceSeconds = (items: number) => 8 + items * 3;
const GOOD_TIMES = 1.6;
/** Past this many times the great mark, no tip is left. */
export const SLOW_TIMES = 2.5;

export function serviceRating(seconds: number, items: number): ServiceRating {
  const great = greatServiceSeconds(items);
  if (seconds <= great) return 'great';
  if (seconds <= great * GOOD_TIMES) return 'good';
  if (seconds <= great * SLOW_TIMES) return 'ok';
  return 'slow';
}

export const stars = (state: GameState) => Math.min(MAX_STARS, Math.floor(state.reputation / POINTS_PER_STAR));

export function changeReputation(state: GameState, delta: number): void {
  state.reputation = Math.max(0, Math.min(MAX_REPUTATION, state.reputation + delta));
}

const TIP_PERCENT: Record<ServiceRating, number> = { great: 20, good: 10, ok: 5, slow: 0 };
const REPUTATION_POINTS: Record<ServiceRating, number> = { great: 0.5, good: 0.25, ok: 0.1, slow: -0.25 };
const OVERPAID_POINTS = -1;
/** Someone went for a snack you're licensed to sell but hadn't stocked. */
export const MISSED_SALE_POINTS = -0.1;
export const EMPTY_SHELVES_POINTS = -2;

/** Better known shops get slightly better tips, up to the full percentage at five stars. */
const reputationTipFactor = (state: GameState) => 0.75 + stars(state) * 0.05;

export function tipFor(state: GameState, total: number, rating: ServiceRating): number {
  return roundToNickel((total * TIP_PERCENT[rating] * reputationTipFactor(state)) / 100);
}

export interface ServiceResult {
  rating: ServiceRating;
  tip: number;
}

/** Scores a finished sale. Handing over too much change means no tip and a dent in your name. */
export function settleService(state: GameState, total: number, items: number, seconds: number, overpaid: number): ServiceResult {
  const rating = serviceRating(seconds, items);
  if (overpaid > 0) {
    changeReputation(state, OVERPAID_POINTS);
    return { rating, tip: 0 };
  }
  const tip = tipFor(state, total, rating);
  changeReputation(state, REPUTATION_POINTS[rating]);
  return { rating, tip };
}

/** A good name brings more people to the window. */
export const reputationCrowd = (state: GameState) => 0.85 + stars(state) * 0.06;
