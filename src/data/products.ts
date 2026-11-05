export type ProductKind = 'food' | 'game';

export interface Product {
  id: string;
  name: string;
  /** Fits on a shelf label. */
  short: string;
  kind: ProductKind;
  /** Prices are whole cents. */
  wholesale: number;
  retail: number;
  /** Cost to unlock, in cents. Products without one are available from the start. */
  licence?: number;
}

export const PRODUCTS: Product[] = [
  { id: 'chips', name: 'CRUNCH CHIPS', short: 'CHIPS', kind: 'food', wholesale: 100, retail: 129 },
  { id: 'soda', name: 'FIZZ SODA', short: 'SODA', kind: 'food', wholesale: 90, retail: 119 },
  { id: 'choco', name: 'CHOCO BAR', short: 'CHOCO', kind: 'food', wholesale: 115, retail: 149 },
  { id: 'noodle', name: 'NOODLE CUP', short: 'CUP', kind: 'food', wholesale: 155, retail: 199 },
  { id: 'jerky', name: 'JERKY STICK', short: 'JERKY', kind: 'food', wholesale: 150, retail: 279, licence: 7500 },
  { id: 'pie', name: 'MEAT PIE', short: 'PIE', kind: 'food', wholesale: 160, retail: 349, licence: 15000 },
  { id: 'golf', name: 'GOBLIN GOLF', short: 'GOLF', kind: 'game', wholesale: 1650, retail: 1999 },
  { id: 'mops', name: 'SPACE MOPS', short: 'MOPS', kind: 'game', wholesale: 2050, retail: 2499 },
  { id: 'chef', name: 'NINJA CHEF', short: 'CHEF', kind: 'game', wholesale: 1800, retail: 2799, licence: 25000 },
  { id: 'disco', name: 'DISCO DRAGON', short: 'DISCO', kind: 'game', wholesale: 1900, retail: 3299, licence: 45000 },
  { id: 'toad', name: 'TURBO TOAD', short: 'TOAD', kind: 'game', wholesale: 1900, retail: 3499, licence: 75000 },
  { id: 'cave', name: 'CAVE QUEST 2', short: 'CAVE', kind: 'game', wholesale: 2000, retail: 3999, licence: 120000 },
];

const BY_ID = new Map(PRODUCTS.map((p) => [p.id, p]));

export function getProduct(id: string): Product {
  const product = BY_ID.get(id);
  if (!product) throw new Error(`Unknown product: ${id}`);
  return product;
}

export const SHELF_CAPACITY: Record<ProductKind, number> = { food: 12, game: 6 };
