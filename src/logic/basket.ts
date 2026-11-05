export type HandOverResult =
  | { status: 'extra'; productId: string }
  | { status: 'still-on-shelf'; productId: string }
  | { status: 'nothing'; missed: number }
  | { status: 'ok'; missed: number };

function tally(ids: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
}

/**
 * Checks the table against what the customer asked for.
 * Wrong items and things you still have on a shelf must be sorted out first;
 * anything truly out of stock is a missed sale.
 */
export function checkHandOver(wanted: string[], table: string[], isOnShelf: (id: string) => boolean): HandOverResult {
  const want = tally(wanted);
  for (const [id, qty] of tally(table)) {
    if (qty > (want.get(id) ?? 0)) return { status: 'extra', productId: id };
  }
  const have = tally(table);
  let missed = 0;
  for (const [id, qty] of want) {
    const short = qty - (have.get(id) ?? 0);
    if (short <= 0) continue;
    if (isOnShelf(id)) return { status: 'still-on-shelf', productId: id };
    missed += short;
  }
  return table.length === 0 ? { status: 'nothing', missed } : { status: 'ok', missed };
}

export interface RequestLine {
  productId: string;
  qty: number;
  done: boolean;
  /** Not enough on the table, and none left on the shelves. */
  soldOut: boolean;
}

/** Each requested product once, with how many are wanted and whether it can still be supplied. */
export function requestLines(wanted: string[], table: string[], isOnShelf: (id: string) => boolean): RequestLine[] {
  const have = tally(table);
  return [...tally(wanted)].map(([productId, qty]) => {
    const done = (have.get(productId) ?? 0) >= qty;
    return { productId, qty, done, soldOut: !done && !isOnShelf(productId) };
  });
}
