export type ProductKind = 'food' | 'game';

export interface Product {
  id: string;
  name: string;
  kind: ProductKind;
  /** Prices are whole cents. */
  wholesale: number;
  retail: number;
}

export const PRODUCTS: Product[] = [
  { id: 'chips', name: 'CRUNCH CHIPS', kind: 'food', wholesale: 60, retail: 129 },
  { id: 'soda', name: 'FIZZ SODA', kind: 'food', wholesale: 50, retail: 119 },
  { id: 'choco', name: 'CHOCO BAR', kind: 'food', wholesale: 70, retail: 149 },
  { id: 'noodle', name: 'NOODLE CUP', kind: 'food', wholesale: 90, retail: 199 },
  { id: 'jerky', name: 'JERKY STICK', kind: 'food', wholesale: 130, retail: 279 },
  { id: 'pie', name: 'MEAT PIE', kind: 'food', wholesale: 160, retail: 349 },
  { id: 'golf', name: 'GOBLIN GOLF', kind: 'game', wholesale: 1200, retail: 1999 },
  { id: 'mops', name: 'SPACE MOPS', kind: 'game', wholesale: 1400, retail: 2499 },
  { id: 'chef', name: 'NINJA CHEF', kind: 'game', wholesale: 1500, retail: 2799 },
  { id: 'disco', name: 'DISCO DRAGON', kind: 'game', wholesale: 1800, retail: 3299 },
  { id: 'toad', name: 'TURBO TOAD', kind: 'game', wholesale: 2000, retail: 3499 },
  { id: 'cave', name: 'CAVE QUEST 2', kind: 'game', wholesale: 2400, retail: 3999 },
];

const BY_ID = new Map(PRODUCTS.map((p) => [p.id, p]));

export function getProduct(id: string): Product {
  const product = BY_ID.get(id);
  if (!product) throw new Error(`Unknown product: ${id}`);
  return product;
}

export const SHELF_CAPACITY: Record<ProductKind, number> = { food: 12, game: 6 };
