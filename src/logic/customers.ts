import type { GameState } from './state';

export interface CustomerRequest {
  /** What they'll buy. Always in stock on the shelves right now. */
  wants: string[];
  /** Licensed snacks they went for that weren't on a shelf. Each one is a sale you missed. */
  wished: string[];
}

/**
 * Decides what a customer asks for when they reach the window. They pick 1 to 4
 * snacks from everything you're licensed to sell, so an unstocked snack lowers the
 * most they can spend. If you have anything at all, they'll buy at least one thing.
 */
export function buildRequest(state: GameState, rng: () => number = Math.random): CustomerRequest {
  const left = new Map<string, number>();
  for (const shelf of state.shelves) {
    if (shelf.productId && shelf.qty > 0) left.set(shelf.productId, (left.get(shelf.productId) ?? 0) + shelf.qty);
  }
  const pick = <T,>(items: T[]) => items[Math.floor(rng() * items.length)];

  const wants: string[] = [];
  const wished: string[] = [];
  const count = 1 + Math.floor(rng() * 4);
  for (let i = 0; i < count; i++) {
    const id = pick(state.unlocked);
    const available = left.get(id) ?? 0;
    if (available > 0) {
      wants.push(id);
      left.set(id, available - 1);
    } else {
      wished.push(id);
    }
  }
  if (wants.length === 0 && left.size > 0) {
    wants.push(pick([...left.keys()]));
    wished.pop();
  }
  return { wants, wished };
}

/** Seconds until the next customer joins the line. Gets a little busier each day, up to a limit. */
export function nextSpawnDelay(day: number, rng: () => number = Math.random): number {
  const base = Math.max(12, 22 - day);
  return base * (0.7 + rng() * 0.6);
}

/** When nobody is at the window or in line, the next customer is never more than this far away. */
export const IDLE_MAX_SECONDS = 3;

export function shortenWhenIdle(spawnIn: number, idle: boolean): number {
  return idle ? Math.min(spawnIn, IDLE_MAX_SECONDS) : spawnIn;
}

export function chooseCash(rng: () => number = Math.random): boolean {
  return rng() < 0.55;
}
