import { getProduct, PRODUCTS } from '../data/products';
import { TAGS, type TagId } from '../data/tags';
import type { GameState } from './state';

/**
 * A want is either a product id, or `tag:<tag>` when any product of that kind will do.
 * The table always holds real product ids.
 */
const TAG_PREFIX = 'tag:';
export const tagWant = (tag: TagId) => `${TAG_PREFIX}${tag}`;
export const wantTag = (want: string): TagId | null => (want.startsWith(TAG_PREFIX) ? (want.slice(TAG_PREFIX.length) as TagId) : null);

function tally(ids: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
}

/**
 * Shares the table out between the wants. Each product fills its own exact wants first, and anything beyond goes
 * towards a want for its kind. Each product has a single tag, so this simple split is always the best one.
 */
function share(wants: string[], table: string[]) {
  const asked = tally(wants);
  const exact = new Map<string, number>();
  const byTag = new Map<TagId, number>();
  for (const [id, qty] of tally(table)) {
    const own = Math.min(qty, asked.get(id) ?? 0);
    exact.set(id, own);
    const extra = qty - own;
    if (extra > 0) {
      const tag = getProduct(id).tag;
      byTag.set(tag, (byTag.get(tag) ?? 0) + extra);
    }
  }
  const fits = [...byTag].every(([tag, qty]) => qty <= (asked.get(tagWant(tag)) ?? 0));
  return { asked, exact, byTag, fits };
}

/** The table only ever holds what the customer asked for, so this is checked before moving an item. */
export function canAddToTable(wants: string[], table: string[], productId: string): boolean {
  return share(wants, [...table, productId]).fits;
}

export function isOrderComplete(wants: string[], table: string[]): boolean {
  return requestLines(wants, table).every((line) => line.done);
}

export interface RequestLine {
  /** A product id, or a tag want. */
  want: string;
  /** Set when any product of this kind will do. */
  tag: TagId | null;
  /** How many are still needed. Counts down as you add items. */
  remaining: number;
  done: boolean;
}

/** Each requested product or kind once, with how many are still needed on the table. Kinds come last. */
export function requestLines(wants: string[], table: string[]): RequestLine[] {
  const { asked, exact, byTag } = share(wants, table);
  const lines = [...asked].map(([want, qty]): RequestLine => {
    const tag = wantTag(want);
    const have = tag ? byTag.get(tag) ?? 0 : exact.get(want) ?? 0;
    const remaining = Math.max(0, qty - have);
    return { want, tag, remaining, done: remaining === 0 };
  });
  return [...lines.filter((l) => !l.tag), ...lines.filter((l) => l.tag)];
}

/** Products of this kind with some left over, given how many of each are still free. */
export function tagChoices(free: Map<string, number>, tag: TagId): string[] {
  return PRODUCTS.filter((p) => p.tag === tag && (free.get(p.id) ?? 0) > 0).map((p) => p.id);
}

/** What's on the shelves and not already promised to one of the customer's exact wants. */
export function freeOnShelves(state: GameState, wants: string[], table: string[]): Map<string, number> {
  const free = new Map<string, number>();
  for (const shelf of state.shelves) {
    if (shelf.productId && shelf.qty > 0) free.set(shelf.productId, (free.get(shelf.productId) ?? 0) + shelf.qty);
  }
  for (const line of requestLines(wants, table)) {
    if (!line.tag) free.set(line.want, (free.get(line.want) ?? 0) - line.remaining);
  }
  return free;
}

/**
 * What to call a line on the customer's list. A kind is only named when there's a choice to make;
 * with a single product left that would do, the customer names it.
 */
export function lineName(state: GameState, wants: string[], table: string[], line: RequestLine): string {
  if (!line.tag) return getProduct(line.want).name;
  if (!line.done) {
    const choices = tagChoices(freeOnShelves(state, wants, table), line.tag);
    if (choices.length === 1) return getProduct(choices[0]).name;
  }
  return TAGS[line.tag].ask;
}
