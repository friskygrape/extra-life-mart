export interface Product {
  id: string;
  name: string;
  /** Fits on a shelf label. */
  short: string;
  /** Prices are whole cents. */
  wholesale: number;
  retail: number;
  /** Cost to unlock, in cents. Products without one are available from the start. */
  licence?: number;
}

export const PRODUCTS: Product[] = [
  { id: 'chips', name: 'CRUNCH CHIPS', short: 'CHIPS', wholesale: 80, retail: 149 },
  { id: 'soda', name: 'FIZZ SODA', short: 'SODA', wholesale: 70, retail: 129 },
  { id: 'choco', name: 'CHOCO BAR', short: 'CHOCO', wholesale: 90, retail: 169 },
  { id: 'noodle', name: 'NOODLE CUP', short: 'CUP', wholesale: 130, retail: 229 },
  { id: 'jerky', name: 'JERKY STICK', short: 'JERKY', wholesale: 150, retail: 319, licence: 4000 },
  { id: 'icepop', name: 'ICE POP', short: 'POP', wholesale: 120, retail: 319, licence: 7000 },
  { id: 'popcorn', name: 'POPCORN', short: 'CORN', wholesale: 110, retail: 339, licence: 11000 },
  { id: 'coconut', name: 'COCONUT WATER', short: 'COCO', wholesale: 180, retail: 449, licence: 16000 },
  { id: 'pie', name: 'MEAT PIE', short: 'PIE', wholesale: 160, retail: 479, licence: 23000 },
  { id: 'taco', name: 'FISH TACO', short: 'TACO', wholesale: 220, retail: 599, licence: 32000 },
  { id: 'lemon', name: 'LEMONADE', short: 'LEMON', wholesale: 150, retail: 599, licence: 45000 },
  { id: 'shave', name: 'SHAVE ICE', short: 'SHAVE', wholesale: 170, retail: 699, licence: 60000 },
];

const BY_ID = new Map(PRODUCTS.map((p) => [p.id, p]));

export function getProduct(id: string): Product {
  const product = BY_ID.get(id);
  if (!product) throw new Error(`Unknown product: ${id}`);
  return product;
}

export const SHELF_CAPACITY = 12;
/** Stock is ordered in boxes of this many units. */
export const BOX_SIZE = 10;
