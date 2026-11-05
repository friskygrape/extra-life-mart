import { nothingToSell } from './day';
import { anyShelfStocked } from './inventory';
import type { GameState } from './state';

export type OnboardingStep = 'shelf' | 'sign';

/** Which first-day instruction to show, if any. Worked out from the game, so it survives a refresh. */
export function onboardingStep(state: GameState, phase: string): OnboardingStep | null {
  if (state.day !== 1 || phase !== 'morning' || state.closed || nothingToSell(state)) return null;
  return anyShelfStocked(state) ? 'sign' : 'shelf';
}
