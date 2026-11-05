export interface ShelfSlot {
  id: string;
  col: number;
  row: number;
}

export const SHELF_COLS = 4;
export const SHELF_ROWS = 3;

/** You start with the first row. These buy the second and third. */
export const SHELF_ROW_PRICES = [6000, 15000];

export const SHELF_SLOTS: ShelfSlot[] = Array.from({ length: SHELF_ROWS }, (_, row) =>
  Array.from({ length: SHELF_COLS }, (_, col) => ({ id: `shelf-${row}-${col}`, col, row })),
).flat();

export const slotsInRow = (row: number) => SHELF_SLOTS.filter((s) => s.row === row);
