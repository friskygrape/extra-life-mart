import { APPLIANCES, BLEND_SECONDS, BREW_SECONDS, POT_CUPS, SMOOTHIE_FRUIT, getAppliance, smoothieFor, type ApplianceId } from '../data/appliances';
import type { GameState } from './state';

export const owns = (state: GameState, id: ApplianceId) => state.appliances.includes(id);

/** Pays for an appliance and unlocks its drinks and ingredients. */
export function buyAppliance(state: GameState, id: ApplianceId): boolean {
  const appliance = getAppliance(id);
  if (owns(state, id) || appliance.price > state.balance) return false;
  state.balance -= appliance.price;
  state.stats.upgradeSpend += appliance.price;
  state.appliances.push(id);
  for (const unlock of appliance.unlocks) if (!state.unlocked.includes(unlock)) state.unlocked.push(unlock);
  return true;
}

/** The appliance that makes a drink. */
export const applianceFor = (drinkId: string): ApplianceId => (drinkId === 'coffee' ? 'coffee' : 'blender');

/** A fresh pot can only go on once the last one is finished. */
export const canBrew = (state: GameState) => owns(state, 'coffee') && state.coffeePot === 0 && state.brewLeft === 0 && (state.stockroom.beans ?? 0) > 0;

/** Uses a bag of beans and starts the machine. The filter and beans going in are just for show. */
export function startBrew(state: GameState): boolean {
  if (!canBrew(state)) return false;
  state.stockroom.beans -= 1;
  state.brewLeft = BREW_SECONDS;
  return true;
}

/** The jar takes one fruit at a time, and only once it's empty. */
export const canLoadFruit = (state: GameState, fruit: string) =>
  owns(state, 'blender') && state.blenderJar === null && state.blendLeft === 0 && (state.stockroom[fruit] ?? 0) > 0;

/** Uses a fruit and blends it, with ice from the endless bin. */
export function startBlend(state: GameState, fruit: string): boolean {
  if (!canLoadFruit(state, fruit)) return false;
  state.stockroom[fruit] -= 1;
  state.blenderJar = smoothieFor(fruit);
  state.blendLeft = BLEND_SECONDS;
  return true;
}

/** Runs the machines. Nothing spoils, so they keep what they've made. */
export function tickAppliances(state: GameState, dt: number): void {
  if (state.brewLeft > 0) {
    state.brewLeft = Math.max(0, state.brewLeft - dt);
    if (state.brewLeft === 0) state.coffeePot = POT_CUPS;
  }
  if (state.blendLeft > 0) state.blendLeft = Math.max(0, state.blendLeft - dt);
}

/** A machine left running when the game was saved has finished by the time it's loaded. */
export function finishAppliances(state: GameState): void {
  tickAppliances(state, Math.max(state.brewLeft, state.blendLeft));
}

export const smoothieReady = (state: GameState) => state.blenderJar !== null && state.blendLeft === 0;

/** Pours one drink, if there's one ready. */
export function pourDrink(state: GameState, drinkId: string): boolean {
  if (drinkId === 'coffee') {
    if (state.coffeePot <= 0) return false;
    state.coffeePot -= 1;
    return true;
  }
  if (!smoothieReady(state) || state.blenderJar !== drinkId) return false;
  state.blenderJar = null;
  return true;
}

/** Throws out a finished smoothie, freeing the blender. Its fruit is gone. */
export function emptyBlender(state: GameState): boolean {
  if (state.blenderJar === null || state.blendLeft > 0) return false;
  state.blenderJar = null;
  return true;
}

/** A drink taken back off the counter goes back where it came from, if there's room. */
export function returnDrink(state: GameState, drinkId: string): boolean {
  if (drinkId === 'coffee') {
    if (state.coffeePot >= POT_CUPS || state.brewLeft > 0) return false;
    state.coffeePot += 1;
    return true;
  }
  if (state.blenderJar !== null || state.blendLeft > 0) return false;
  state.blenderJar = drinkId;
  return true;
}

/** How many of a drink could be served: what's made, plus what the ingredients in stock would make. */
export function drinksAvailable(state: GameState, drinkId: string): number {
  if (!owns(state, applianceFor(drinkId))) return 0;
  if (drinkId === 'coffee') {
    const brewing = state.brewLeft > 0 ? POT_CUPS : 0;
    return state.coffeePot + brewing + (state.stockroom.beans ?? 0) * POT_CUPS;
  }
  const fruit = SMOOTHIE_FRUIT[drinkId];
  return (state.stockroom[fruit] ?? 0) + (state.blenderJar === drinkId ? 1 : 0);
}

export { APPLIANCES };

export const DECANTER_STATES = ['empty', 'low', 'half', 'three_quarter', 'full'] as const;
export type DecanterState = (typeof DECANTER_STATES)[number];

/** The decanter's look: filling through every state while it brews, then showing what's left. */
export function decanterState(cups: number, brewLeft: number): DecanterState {
  if (brewLeft > 0) {
    const progress = 1 - brewLeft / BREW_SECONDS;
    return DECANTER_STATES[Math.min(DECANTER_STATES.length - 1, Math.floor(progress * DECANTER_STATES.length))];
  }
  if (cups <= 0) return 'empty';
  if (cups >= POT_CUPS) return 'full';
  // Part full: the closest of the in-between states, so one cup left is never shown as empty or full.
  const middle: DecanterState[] = ['low', 'half', 'three_quarter'];
  const steps = [0.25, 0.5, 0.75];
  const fraction = cups / POT_CUPS;
  let best = 0;
  steps.forEach((step, i) => {
    if (Math.abs(step - fraction) < Math.abs(steps[best] - fraction)) best = i;
  });
  return middle[best];
}
