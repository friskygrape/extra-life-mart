function tally(ids: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
}

/** The table only ever holds what the customer asked for, so this is checked before moving an item. */
export function canAddToTable(wants: string[], table: string[], productId: string): boolean {
  return (tally(table).get(productId) ?? 0) < (tally(wants).get(productId) ?? 0);
}

export function isOrderComplete(wants: string[], table: string[]): boolean {
  const have = tally(table);
  return [...tally(wants)].every(([id, qty]) => (have.get(id) ?? 0) >= qty);
}

export interface RequestLine {
  productId: string;
  qty: number;
  done: boolean;
}

/** Each requested product once, with how many are wanted and whether enough are on the table. */
export function requestLines(wants: string[], table: string[]): RequestLine[] {
  const have = tally(table);
  return [...tally(wants)].map(([productId, qty]) => ({ productId, qty, done: (have.get(productId) ?? 0) >= qty }));
}
