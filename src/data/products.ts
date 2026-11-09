import { tinyTextWidth } from '../art/fontMetrics';
import type { TagId } from './tags';

/**
 * Shelf products are stocked and sold from the shelves. Drinks are made at an appliance and sold.
 * Ingredients are ordered and used up making drinks, and never sold.
 */
export type ProductKind = 'shelf' | 'drink' | 'ingredient';

export interface Product {
  id: string;
  name: string;
  tag: TagId;
  kind: ProductKind;
  /** Prices are whole cents. */
  wholesale: number;
  retail: number;
  /** Cost to unlock, in cents. Shelf products without one are available from the start. */
  licence?: number;
}

export const PRODUCTS: Product[] = [
  { id: 'chips', name: 'BBQ CHIPS', tag: 'snacks', kind: 'shelf', wholesale: 80, retail: 189 },
  { id: 'soda', name: 'GRAPE SODA', tag: 'drinks', kind: 'shelf', wholesale: 70, retail: 159 },
  { id: 'choco', name: 'CARAMEL BAR', tag: 'sweets', kind: 'shelf', wholesale: 90, retail: 209 },
  { id: 'noodle', name: 'SPICY NOODLES', tag: 'hot', kind: 'shelf', wholesale: 130, retail: 279 },
  { id: 'jerky', name: 'BEEF JERKY', tag: 'snacks', kind: 'shelf', wholesale: 150, retail: 399, licence: 4000 },
  { id: 'icepop', name: 'BERRY POP', tag: 'frozen', kind: 'shelf', wholesale: 120, retail: 419, licence: 7000 },
  { id: 'popcorn', name: 'KETTLE CORN', tag: 'sweets', kind: 'shelf', wholesale: 110, retail: 449, licence: 11000 },
  { id: 'coconut', name: 'COCO WATER', tag: 'drinks', kind: 'shelf', wholesale: 180, retail: 589, licence: 16000 },
  { id: 'pie', name: 'BEEF PIE', tag: 'hot', kind: 'shelf', wholesale: 160, retail: 639, licence: 23000 },
  { id: 'taco', name: 'FISH TACO', tag: 'hot', kind: 'shelf', wholesale: 220, retail: 789, licence: 32000 },
  { id: 'lemon', name: 'LEMONADE', tag: 'drinks', kind: 'shelf', wholesale: 150, retail: 819, licence: 45000 },
  { id: 'shave', name: 'RAINBOW ICE', tag: 'frozen', kind: 'shelf', wholesale: 170, retail: 959, licence: 60000 },
  // Made at the appliances. Their cost is what their ingredients cost per drink.
  { id: 'coffee', name: 'COFFEE', tag: 'hot', kind: 'drink', wholesale: 15, retail: 199 },
  { id: 'smoothie_mango', name: 'MANGO SMOOTHIE', tag: 'drinks', kind: 'drink', wholesale: 150, retail: 549 },
  { id: 'smoothie_pineapple', name: 'PINEAPPLE SMOOTHIE', tag: 'drinks', kind: 'drink', wholesale: 150, retail: 549 },
  { id: 'smoothie_watermelon', name: 'WATERMELON SMOOTHIE', tag: 'drinks', kind: 'drink', wholesale: 150, retail: 549 },
  // What the drinks are made from
  { id: 'beans', name: 'COFFEE BEANS', tag: 'coffee', kind: 'ingredient', wholesale: 75, retail: 0 },
  { id: 'mango', name: 'MANGO', tag: 'fruit', kind: 'ingredient', wholesale: 150, retail: 0 },
  { id: 'pineapple', name: 'PINEAPPLE', tag: 'fruit', kind: 'ingredient', wholesale: 150, retail: 0 },
  { id: 'watermelon', name: 'WATERMELON', tag: 'fruit', kind: 'ingredient', wholesale: 150, retail: 0 },
];

export const isShelfProduct = (id: string) => getProduct(id).kind === 'shelf';
export const isDrink = (id: string) => getProduct(id).kind === 'drink';
/** Things you can order from the computer: shelf products and ingredients. */
export const isOrderable = (id: string) => getProduct(id).kind !== 'drink';

const BY_ID = new Map(PRODUCTS.map((p) => [p.id, p]));

export function getProduct(id: string): Product {
  const product = BY_ID.get(id);
  if (!product) throw new Error(`Unknown product: ${id}`);
  return product;
}

/**
 * The name to print on a shelf label, over one or two lines, with the price on the right of one of them.
 * The full name is always shown, broken between words when it doesn't fit on one line.
 */
export function shelfLabelLines(product: Pick<Product, 'name'>, rightText: string, plateWidth: number): { lines: string[]; rightLine: number } {
  const beside = plateWidth - tinyTextWidth(rightText) - 2;
  const fits = (text: string, room: number) => tinyTextWidth(text) <= room;
  if (fits(product.name, beside)) return { lines: [product.name], rightLine: 0 };
  const words = product.name.split(' ');
  // The last option keeps the whole name on the first line, with the price alone beneath it.
  const splits = Array.from({ length: words.length }, (_, i) => [words.slice(0, i + 1).join(' '), words.slice(i + 1).join(' ')]);
  // The price goes on whichever line leaves it room, preferring the first.
  for (const rightLine of [0, 1]) {
    const split = splits.find(([a, b]) => fits(a, rightLine === 0 ? beside : plateWidth) && fits(b, rightLine === 1 ? beside : plateWidth));
    if (split) return { lines: split, rightLine };
  }
  return { lines: [product.name], rightLine: 1 };
}

export const SHELF_CAPACITY = 12;
/** Stock is ordered in boxes that fill exactly one shelf. */
export const BOX_SIZE = SHELF_CAPACITY;
