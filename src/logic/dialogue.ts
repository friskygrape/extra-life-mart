import { nextEvent, eventOnDay } from '../data/events';
import { REGULARS } from '../data/regulars';
import type { WeatherId } from '../data/weather';
import { weekdayName } from './calendar';
import type { GameState } from './state';

const TODAY_LINES: Record<WeatherId, string[]> = {
  sunny: ['WHAT A DAY! NOT A CLOUD IN THE SKY.', 'THE SUN IS OUT AND SO IS EVERYONE ELSE.'],
  heatwave: ['IT IS BOILING OUT HERE! GOOD THING YOU ARE OPEN.', 'THE SAND IS TOO HOT TO WALK ON TODAY!'],
  rainy: ['SOAKED! I CAME OUT ANYWAY, JUST FOR YOU.', 'NICE AND DRY UNDER YOUR AWNING.'],
  cloudy: ['GREY SKIES, BUT I LIKE A QUIET BEACH.', 'NO SUN TODAY. PERFECT WEATHER FOR SNACKING.'],
};

const FORECAST_LINES: Record<WeatherId, string[]> = {
  sunny: ['HEARD TOMORROW IS SUNNY. PERFECT BEACH DAY!', 'CLEAR SKIES TOMORROW, THEY SAY.'],
  heatwave: ['HEATWAVE TOMORROW. COLD DRINKS WILL FLY!', 'THEY SAY TOMORROW IS A SCORCHER. BETTER STOCK COLD DRINKS.'],
  rainy: ['RAIN TOMORROW. HOT FOOD WILL SELL.', 'BRING AN UMBRELLA TOMORROW. HOT FOOD WEATHER.'],
  cloudy: ['CLOUDY TOMORROW. EVERYONE WILL WANT SNACKS.', 'GREY DAY TOMORROW. GOOD WEATHER FOR SNACKS.'],
};

const RENT_WORRY_LINES = [
  'HEARD THE LANDLORD WAS ASKING AFTER YOU. HANG IN THERE.',
  'TELL ME THIS PLACE IS NOT CLOSING. I NEED IT.',
  'BUYING EXTRA TODAY. YOU LOOK LIKE YOU NEED IT.',
];

const CHANCES = { rent: 0.2, event: 0.35, forecast: 0.2, today: 0.12 };
/** Days ahead that customers start talking about an event. */
const EVENT_HINT_DAYS = 3;

/** Lines heard recently are skipped, so a regular doesn't repeat themselves straight away. */
export function pickGreeting(state: GameState, look: number, recent: string[] = [], rng: () => number = Math.random): string {
  const pick = (lines: string[]) => {
    const fresh = lines.filter((line) => !recent.includes(line));
    const pool = fresh.length > 0 ? fresh : lines;
    return pool[Math.floor(rng() * pool.length)];
  };
  if (state.rentBehind > 0 && rng() < CHANCES.rent) return pick(RENT_WORRY_LINES);
  const eventToday = eventOnDay(state.day);
  if (eventToday && rng() < CHANCES.event) return eventToday.today;
  const coming = nextEvent(state.day + 1, EVENT_HINT_DAYS - 1);
  if (coming && rng() < CHANCES.event) {
    const when = coming.day === state.day + 1 ? 'TOMORROW' : `ON ${weekdayName(coming.day)}`;
    return `${coming.event.name} ${when}! ${coming.event.hint}`;
  }
  if (rng() < CHANCES.forecast) return pick(FORECAST_LINES[state.forecast]);
  if (rng() < CHANCES.today) return pick(TODAY_LINES[state.weather]);
  return pick(REGULARS[look % REGULARS.length].lines);
}

/** Everything a customer could say, for checking it all fits and can be drawn. */
export function allGreetingLines(): string[] {
  return [
    ...RENT_WORRY_LINES,
    ...Object.values(TODAY_LINES).flat(),
    ...Object.values(FORECAST_LINES).flat(),
    ...REGULARS.flatMap((r) => r.lines),
  ];
}
