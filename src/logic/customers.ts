import { eventOnDay } from '../data/events';
import { getProduct, isDrink, isShelfProduct } from '../data/products';
import { drinksAvailable, isCoffee } from './appliances';
import { sellableIds } from './licences';
import { WEATHER } from '../data/weather';
import { tagChoices, tagWant } from './basket';
import { reputationCrowd } from './reputation';
import type { GameState } from './state';

/** How much more a snack is wanted during an event. */
const EVENT_FAVOURITE = 2.5;

/** How much a snack is wanted today, where 1 is normal. Weather and events both count. */
export function snackDemand(state: GameState, productId: string): number {
  const tag = getProduct(productId).tag;
  const weather = WEATHER[state.weather].demand[tag] ?? 1;
  return weather * (eventOnDay(state.day)?.favourites.includes(tag) ? EVENT_FAVOURITE : 1);
}

/** How busy today is, where 1 is normal: weather, events and your reputation all count. */
export function crowdFactor(state: GameState): number {
  return WEATHER[state.weather].crowd * (eventOnDay(state.day)?.crowd ?? 1) * reputationCrowd(state);
}

function pickByDemand(state: GameState, rng: () => number): string {
  const ids = sellableIds(state);
  const weights = ids.map((id) => snackDemand(state, id));
  let r = rng() * weights.reduce((sum, w) => sum + w, 0);
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return ids[i];
  }
  return ids[ids.length - 1];
}

/** How often a customer asks for a kind of snack, like a cold drink, in place of one named item. */
export const TAG_CHANCE = 0.25;

/**
 * Turns one wanted item into its kind, but only where there's a real choice: at least two different
 * products of that kind on the shelves, beyond what the rest of the order already takes.
 */
function askForAKind(wants: string[], left: Map<string, number>, pick: <T>(items: T[]) => T) {
  const options = wants.flatMap((id, i) => {
    if (!isShelfProduct(id)) return [];
    const free = new Map(left).set(id, (left.get(id) ?? 0) + 1);
    return tagChoices(free, getProduct(id).tag).length >= 2 ? [i] : [];
  });
  if (options.length === 0) return;
  const i = pick(options);
  wants[i] = tagWant(getProduct(wants[i]).tag);
}

export interface CustomerRequest {
  /** What they'll buy: product ids, or now and then a kind of snack. Always in stock on the shelves right now. */
  wants: string[];
  /** Licensed snacks they went for that weren't on a shelf. Each one is a sale you missed. */
  wished: string[];
}

/**
 * Decides what a customer asks for when they reach the window. They pick 1 to 4
 * snacks from everything you're licensed to sell, favouring what suits the day, so an
 * unstocked snack lowers the most they can spend. If you have anything at all, they'll
 * buy at least one thing.
 */
export function buildRequest(state: GameState, rng: () => number = Math.random): CustomerRequest {
  const left = new Map<string, number>();
  for (const shelf of state.shelves) {
    if (shelf.productId && shelf.qty > 0) left.set(shelf.productId, (left.get(shelf.productId) ?? 0) + shelf.qty);
  }
  // Drinks count as there when they're made, or could be made from what's in stock.
  for (const id of sellableIds(state)) {
    if (isDrink(id)) {
      const available = drinksAvailable(state, id);
      if (available > 0) left.set(id, available);
    }
  }
  const pick = <T,>(items: T[]) => items[Math.floor(rng() * items.length)];

  const wants: string[] = [];
  const wished: string[] = [];
  const count = 1 + Math.floor(rng() * 4);
  for (let i = 0; i < count; i++) {
    const id = pickByDemand(state, rng);
    const available = left.get(id) ?? 0;
    if (available > 0) {
      wants.push(id);
      left.set(id, available - 1);
      // Hot and iced coffee share one pot, so a cup of either uses up one of both.
      if (isCoffee(id)) for (const other of ['coffee', 'iced_coffee']) if (other !== id && left.has(other)) left.set(other, left.get(other)! - 1);
    } else {
      wished.push(id);
    }
  }
  if (wants.length === 0 && left.size > 0) {
    const id = pick([...left.keys()]);
    wants.push(id);
    left.set(id, (left.get(id) ?? 0) - 1);
    wished.pop();
  }
  if (rng() < TAG_CHANCE) askForAKind(wants, left, pick);
  return { wants, wished };
}

const EMPTY_SHELF_COMMENTS = [
  'WHERE IS ALL THE FOOD?',
  'THESE SHELVES ARE EMPTY!',
  'NOTHING TO BUY HERE?',
  "EMPTY SHELVES? I'LL GO ELSEWHERE.",
];

/** What a customer says on finding nothing at all to buy, just before leaving. */
export function emptyShelfComment(rng: () => number = Math.random): string {
  return EMPTY_SHELF_COMMENTS[Math.floor(rng() * EMPTY_SHELF_COMMENTS.length)];
}

/** Seconds until the next customer joins the line. Gets a little busier each day, up to a limit. */
export function nextSpawnDelay(state: GameState, rng: () => number = Math.random): number {
  const base = Math.max(12, 22 - state.day) / crowdFactor(state);
  return base * (0.7 + rng() * 0.6);
}

/** When nobody is at the window or in line, the next customer is never more than this far away. */
export const IDLE_MAX_SECONDS = 3;
/** On a quiet day, like in the rain, the beach really does empty out for a while. */
const QUIET_DAY_IDLE_SECONDS = 8;

export function idleWait(state: GameState): number {
  return WEATHER[state.weather].crowd < 1 && !eventOnDay(state.day) ? QUIET_DAY_IDLE_SECONDS : IDLE_MAX_SECONDS;
}

export function shortenWhenIdle(spawnIn: number, idle: boolean, longest = IDLE_MAX_SECONDS): number {
  return idle ? Math.min(spawnIn, longest) : spawnIn;
}

/** Picks a character who isn't already at the window or in line, whenever one is free. */
export function pickLook(taken: number[], looks: number, rng: () => number = Math.random): number {
  const free = Array.from({ length: looks }, (_, i) => i).filter((i) => !taken.includes(i));
  const pool = free.length > 0 ? free : Array.from({ length: looks }, (_, i) => i);
  return pool[Math.floor(rng() * pool.length)];
}

export function chooseCash(rng: () => number = Math.random): boolean {
  return rng() < 0.55;
}
