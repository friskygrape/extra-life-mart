import { nothingToSell } from './day';
import { anyShelfStocked } from './inventory';
import type { GameState } from './state';

export type OnboardingStep = 'shelf' | 'sign' | 'computer';

/**
 * Which first-day instruction to show, if any. The first two only apply until the store
 * first opens. The last one is for when a shelf has sold out that same day.
 */
export function onboardingStep(state: GameState, phase: string, shelfSoldOut = false): OnboardingStep | null {
  if (state.day !== 1 || state.closed) return null;
  if (phase === 'open' || phase === 'closing') return shelfSoldOut ? 'computer' : null;
  if (phase !== 'morning' || state.hasOpened || nothingToSell(state)) return null;
  return anyShelfStocked(state) ? 'sign' : 'shelf';
}
