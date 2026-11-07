import { nothingToSell } from './day';
import { anyShelfStocked } from './inventory';
import type { GameState } from './state';

export type OnboardingStep = 'shelf' | 'sign' | 'computer' | 'close';

/**
 * Which first-day instruction to show, if any. The first two only apply until the store
 * first opens. 'computer' is for when a shelf has sold out that same day, and 'close'
 * explains how to go home, once it's past closing time and everyone has been served.
 */
export function onboardingStep(state: GameState, phase: string, shelfSoldOut = false, everyoneServed = false): OnboardingStep | null {
  if (state.day !== 1 || state.closed) return null;
  if (phase === 'closing' && everyoneServed) return 'close';
  if (phase === 'open' || phase === 'closing') return shelfSoldOut ? 'computer' : null;
  if (phase !== 'morning' || state.hasOpened || nothingToSell(state)) return null;
  return anyShelfStocked(state) ? 'sign' : 'shelf';
}
