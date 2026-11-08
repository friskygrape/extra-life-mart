import type { TagId } from './tags';

export type WeatherId = 'sunny' | 'heatwave' | 'rainy' | 'cloudy';

export interface Weather {
  id: WeatherId;
  /** Fits beside TOMORROW: on the order screen. */
  short: string;
  /** How busy the day is, where 1 is normal. */
  crowd: number;
  /** How much more or less each kind of snack is wanted. Anything not listed stays at 1. */
  demand: Partial<Record<TagId, number>>;
}

export const WEATHER: Record<WeatherId, Weather> = {
  sunny: { id: 'sunny', short: 'SUNNY', crowd: 1, demand: {} },
  heatwave: {
    id: 'heatwave',
    short: 'HEAT',
    crowd: 1.2,
    demand: { drinks: 3, frozen: 3.5, sweets: 0.5, hot: 0.4 },
  },
  rainy: {
    id: 'rainy',
    short: 'RAIN',
    crowd: 0.75,
    demand: { hot: 3.5, sweets: 1.5, drinks: 0.5, frozen: 0.3 },
  },
  cloudy: {
    id: 'cloudy',
    short: 'CLOUD',
    crowd: 0.9,
    demand: { snacks: 2.5, sweets: 1.5, frozen: 0.6 },
  },
};

const ODDS: [WeatherId, number][] = [
  ['sunny', 0.4],
  ['heatwave', 0.2],
  ['rainy', 0.2],
  ['cloudy', 0.2],
];

function roll(rng: () => number): WeatherId {
  let r = rng();
  for (const [id, chance] of ODDS) {
    r -= chance;
    if (r < 0) return id;
  }
  return 'sunny';
}

/** Tomorrow's weather. Unusual weather rarely lasts two days, which keeps the week varied. */
export function rollWeather(previous: WeatherId, rng: () => number = Math.random): WeatherId {
  const first = roll(rng);
  return first === previous && first !== 'sunny' ? roll(rng) : first;
}
