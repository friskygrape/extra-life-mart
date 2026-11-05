export type WeatherId = 'sunny' | 'heatwave' | 'rainy' | 'cloudy';

export interface Weather {
  id: WeatherId;
  /** Fits beside TOMORROW: on the order screen. */
  short: string;
  /** How busy the day is, where 1 is normal. */
  crowd: number;
  /** How much more or less each snack is wanted. Anything not listed stays at 1. */
  demand: Record<string, number>;
}

export const WEATHER: Record<WeatherId, Weather> = {
  sunny: { id: 'sunny', short: 'SUNNY', crowd: 1, demand: {} },
  heatwave: {
    id: 'heatwave',
    short: 'HEAT',
    crowd: 1.2,
    demand: { soda: 3, icepop: 3.5, shave: 3.5, lemon: 3, coconut: 3, choco: 0.5, noodle: 0.4, pie: 0.4 },
  },
  rainy: {
    id: 'rainy',
    short: 'RAIN',
    crowd: 0.75,
    demand: { noodle: 3.5, pie: 3.5, taco: 1.5, choco: 1.5, soda: 0.5, icepop: 0.3, shave: 0.3, lemon: 0.4, coconut: 0.5 },
  },
  cloudy: {
    id: 'cloudy',
    short: 'CLOUD',
    crowd: 0.9,
    demand: { chips: 2.5, choco: 1.5, jerky: 2.5, popcorn: 2.5, icepop: 0.6, shave: 0.6 },
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
