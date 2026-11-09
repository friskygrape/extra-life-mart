export type TagId = 'drinks' | 'frozen' | 'snacks' | 'sweets' | 'hot' | 'coffee' | 'fruit';

export interface Tag {
  id: TagId;
  /** Heads the product's group on the computer. */
  heading: string;
  /** What a customer calls one of these when any of them will do. */
  ask: string;
  colour: number;
}

export const TAGS: Record<TagId, Tag> = {
  drinks: { id: 'drinks', heading: 'DRINKS', ask: 'COLD DRINK', colour: 0x3f8ee8 },
  frozen: { id: 'frozen', heading: 'FROZEN', ask: 'FROZEN TREAT', colour: 0x6ad4e6 },
  snacks: { id: 'snacks', heading: 'SNACKS', ask: 'SALTY SNACK', colour: 0xf08a2c },
  sweets: { id: 'sweets', heading: 'SWEETS', ask: 'SWEET TREAT', colour: 0xee6aa8 },
  hot: { id: 'hot', heading: 'HOT FOOD', ask: 'HOT FOOD', colour: 0xe04434 },
  // Ingredients, for the appliances. They're ordered but never sold or asked for by kind.
  coffee: { id: 'coffee', heading: 'COFFEE', ask: 'COFFEE', colour: 0x7a4a2a },
  fruit: { id: 'fruit', heading: 'SMOOTHIE FRUIT', ask: 'FRUIT', colour: 0x7cc04a },
};

/** The order tags are listed in. */
export const TAG_ORDER: TagId[] = ['drinks', 'frozen', 'snacks', 'sweets', 'hot', 'coffee', 'fruit'];
