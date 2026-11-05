import type { ProductKind } from './products';

export interface Tile {
  x: number;
  y: number;
}

/**
 * # wall   . shop floor   , back room floor   D inner door   E entrance
 * C computer   S stock crates   F food shelf   G game rack   T counter   R register
 */
export const MAP_ROWS = [
  '###########',
  '#,C,,,,SSS#',
  '#,,,,,,,,,#',
  '#####D#####',
  '#.........#',
  '#.FFF.GGG.#',
  '#.........#',
  '#.FFF.GGG.#',
  '#.........#',
  '#.........#',
  '#.........#',
  '#.TRTT....#',
  '#.........#',
  '#.........#',
  '#.........#',
  '#####E#####',
];

export const MAP_W = MAP_ROWS[0].length;
export const MAP_H = MAP_ROWS.length;
export const TILE = 16;

export const REGISTER_TILE: Tile = { x: 3, y: 11 };
export const PLAYER_REGISTER_SPOT: Tile = { x: 3, y: 10 };
export const ENTRANCE: Tile = { x: 5, y: 15 };
export const PLAYER_START: Tile = { x: 5, y: 9 };

/** Where customers line up: front of the line first, snaking back across the floor. */
export const QUEUE_SPOTS: Tile[] = [
  ...[3, 4, 5, 6, 7, 8, 9].map((x) => ({ x, y: 12 })),
  ...[9, 8, 7, 6, 4, 3, 2, 1].map((x) => ({ x, y: 13 })),
];

export function tileAt(x: number, y: number): string {
  return MAP_ROWS[y]?.[x] ?? '#';
}

export function isWalkable(x: number, y: number, canUseEntrance: boolean): boolean {
  const t = tileAt(x, y);
  if (t === 'E') return canUseEntrance;
  return t === '.' || t === ',' || t === 'D';
}

export interface ShelfSpot extends Tile {
  id: string;
  kind: ProductKind;
}

export const SHELF_SPOTS: ShelfSpot[] = MAP_ROWS.flatMap((row, y) =>
  [...row].flatMap((ch, x) => {
    if (ch !== 'F' && ch !== 'G') return [];
    return [{ id: `${ch.toLowerCase()}${x}-${y}`, kind: ch === 'F' ? ('food' as const) : ('game' as const), x, y }];
  }),
);

export function neighbours({ x, y }: Tile): Tile[] {
  return [
    { x: x + 1, y },
    { x: x - 1, y },
    { x, y: y + 1 },
    { x, y: y - 1 },
  ];
}
