export type ApplianceId = 'coffee' | 'blender';

export interface Appliance {
  id: ApplianceId;
  name: string;
  /** Shown under its name on the computer's Upgrades page. */
  blurb: string;
  /** In cents. */
  price: number;
  /** The drinks and ingredients buying it unlocks. */
  unlocks: string[];
}

export const APPLIANCES: Appliance[] = [
  { id: 'coffee', name: 'COFFEE MACHINE', blurb: '5 CUPS A POT. USES BEANS', price: 12000, unlocks: ['coffee', 'beans'] },
  {
    id: 'blender',
    name: 'BLENDER',
    blurb: 'SMOOTHIES. USES FRUIT',
    price: 20000,
    unlocks: ['smoothie_mango', 'smoothie_pineapple', 'smoothie_watermelon', 'mango', 'pineapple', 'watermelon'],
  },
];

export const getAppliance = (id: ApplianceId) => APPLIANCES.find((a) => a.id === id)!;

/** The fruit each smoothie is made from. */
export const SMOOTHIE_FRUIT: Record<string, string> = {
  smoothie_mango: 'mango',
  smoothie_pineapple: 'pineapple',
  smoothie_watermelon: 'watermelon',
};
export const smoothieFor = (fruit: string) => Object.keys(SMOOTHIE_FRUIT).find((id) => SMOOTHIE_FRUIT[id] === fruit)!;

/** Cups of coffee in a full pot, and the seconds a brew or a blend takes. */
export const POT_CUPS = 5;
export const BREW_SECONDS = 5;
export const BLEND_SECONDS = 5;
