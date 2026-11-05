import { PRODUCTS } from '../data/products';

const GAME_CHANCE = 0.25;

/** 1 to 4 product ids from what you're licensed to sell. Mostly food, sometimes a game. */
export function buildWishlist(unlocked: string[], rng: () => number = Math.random): string[] {
  const available = PRODUCTS.filter((p) => unlocked.includes(p.id));
  const foods = available.filter((p) => p.kind === 'food');
  const games = available.filter((p) => p.kind === 'game');
  const count = 1 + Math.floor(rng() * 4);
  return Array.from({ length: count }, () => {
    const pool = games.length > 0 && (foods.length === 0 || rng() < GAME_CHANCE) ? games : foods;
    return pool[Math.floor(rng() * pool.length)].id;
  });
}

/** Seconds until the next customer walks in. Gets a little busier each day, up to a limit. */
export function nextSpawnDelay(day: number, rng: () => number = Math.random): number {
  const base = Math.max(12, 22 - day);
  return base * (0.7 + rng() * 0.6);
}

export function chooseCash(rng: () => number = Math.random): boolean {
  return rng() < 0.55;
}
