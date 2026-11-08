export type TagId = 'drinks' | 'frozen' | 'snacks' | 'sweets' | 'hot';

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
};

/** The order tags are listed in. */
export const TAG_ORDER: TagId[] = ['drinks', 'frozen', 'snacks', 'sweets', 'hot'];
