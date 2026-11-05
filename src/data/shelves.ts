import type { ProductKind } from './products';

export interface ShelfSlot {
  id: string;
  kind: ProductKind;
  col: number;
  row: number;
}

/** Three rows of four cubbies under the table: food on the left, games on the right. */
export const SHELF_SLOTS: ShelfSlot[] = [0, 1, 2].flatMap((row) =>
  [0, 1, 2, 3].map((col) => ({
    id: `shelf-${row}-${col}`,
    kind: col < 2 ? ('food' as const) : ('game' as const),
    col,
    row,
  })),
);
