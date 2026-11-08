import type { TagId } from './tags';

export interface BoardwalkEvent {
  id: string;
  name: string;
  /** How much busier the day is, where 1 is normal. */
  crowd: number;
  /** Kinds of snack people want more of during the event. */
  favourites: TagId[];
  /** What customers say beforehand, so you can stock up. */
  hint: string;
  /** What customers say on the day. */
  today: string;
}

const EVENTS: BoardwalkEvent[] = [
  {
    id: 'surf',
    name: 'SURF CONTEST',
    crowd: 1.4,
    favourites: ['drinks', 'snacks'],
    hint: 'SURFERS LOVE COLD DRINKS AND SNACKS.',
    today: 'THE WHOLE BEACH IS OUT FOR THE SURF CONTEST!',
  },
  {
    id: 'market',
    name: 'NIGHT MARKET',
    crowd: 1.3,
    favourites: ['hot', 'snacks'],
    hint: 'EVERYONE WANTS HOT FOOD THERE.',
    today: 'THE NIGHT MARKET BROUGHT THE WHOLE TOWN OUT!',
  },
  {
    id: 'bonfire',
    name: 'BONFIRE NIGHT',
    crowd: 1.3,
    favourites: ['sweets', 'snacks'],
    hint: 'SWEETS AND SNACKS WILL GO FAST.',
    today: "WE'RE BUILDING THE BONFIRE. SMELLS GREAT ALREADY!",
  },
  {
    id: 'kite',
    name: 'KITE FESTIVAL',
    crowd: 1.25,
    favourites: ['frozen', 'sweets'],
    hint: 'KIDS WILL WANT SWEETS AND FROZEN TREATS.',
    today: 'LOOK UP! THE SKY IS FULL OF KITES TODAY!',
  },
  {
    id: 'sandcastle',
    name: 'SANDCASTLE DAY',
    crowd: 1.3,
    favourites: ['snacks', 'frozen'],
    hint: 'BUILDERS LIVE ON SNACKS AND ICE POPS.',
    today: 'SOMEONE BUILT A SANDCASTLE TALLER THAN ME!',
  },
];

const FIRST_EVENT_DAY = 6;
/** Days between one event and the next, repeating. */
const GAPS = [8, 7, 5, 9, 7, 6];

/** Every event up to and including this day, in order. */
function eventAtOrBefore(day: number): { day: number; event: BoardwalkEvent } | null {
  if (day < FIRST_EVENT_DAY) return null;
  let on = FIRST_EVENT_DAY;
  let i = 0;
  while (on + GAPS[i % GAPS.length] <= day) {
    on += GAPS[i % GAPS.length];
    i += 1;
  }
  return { day: on, event: EVENTS[i % EVENTS.length] };
}

export function eventOnDay(day: number): BoardwalkEvent | null {
  const found = eventAtOrBefore(day);
  return found && found.day === day ? found.event : null;
}

/** The next event from this day on, if it's within the given number of days. */
export function nextEvent(day: number, within: number): { day: number; event: BoardwalkEvent } | null {
  for (let d = day; d <= day + within; d++) {
    const event = eventOnDay(d);
    if (event) return { day: d, event };
  }
  return null;
}
