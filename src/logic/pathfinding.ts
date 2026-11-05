import { neighbours, type Tile } from '../data/map';

const key = (t: Tile) => `${t.x},${t.y}`;

/**
 * A* over a 4-directional grid to the closest of several goals.
 * Returns the tiles to step through (excluding start), [] if already there, null if unreachable.
 */
export function findPath(start: Tile, goals: Tile[], isOpen: (t: Tile) => boolean): Tile[] | null {
  const openGoals = goals.filter(isOpen);
  if (openGoals.length === 0) return null;
  const goalKeys = new Set(openGoals.map(key));
  if (goalKeys.has(key(start))) return [];

  const h = (t: Tile) => Math.min(...openGoals.map((g) => Math.abs(g.x - t.x) + Math.abs(g.y - t.y)));
  const cameFrom = new Map<string, Tile>();
  const cost = new Map<string, number>([[key(start), 0]]);
  const frontier: { tile: Tile; f: number }[] = [{ tile: start, f: h(start) }];

  while (frontier.length > 0) {
    let best = 0;
    for (let i = 1; i < frontier.length; i++) if (frontier[i].f < frontier[best].f) best = i;
    const [{ tile }] = frontier.splice(best, 1);

    if (goalKeys.has(key(tile))) {
      const path: Tile[] = [];
      let at: Tile | undefined = tile;
      while (at && key(at) !== key(start)) {
        path.unshift(at);
        at = cameFrom.get(key(at));
      }
      return path;
    }

    const nextCost = cost.get(key(tile))! + 1;
    for (const n of neighbours(tile)) {
      if (!isOpen(n)) continue;
      const known = cost.get(key(n));
      if (known !== undefined && known <= nextCost) continue;
      cost.set(key(n), nextCost);
      cameFrom.set(key(n), tile);
      frontier.push({ tile: n, f: nextCost + h(n) });
    }
  }
  return null;
}
