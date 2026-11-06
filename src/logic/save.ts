import { rollWeather } from '../data/weather';
import { weekdayIndex } from './calendar';
import { START_REPUTATION } from './reputation';
import { SAVE_VERSION, type DayStats, type GameState } from './state';

const SAVE_KEY = 'extra-life-mart-save';

export type SaveStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function saveGame(state: GameState, store: SaveStore): void {
  try {
    store.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // Private browsing or a full disk: the game still plays, it just won't persist.
  }
}

/**
 * Brings a version 4 save up to date. Orders already on their way arrive straight away, as they did
 * then, and the day moves back to that week's Monday, so there's a full week before the first rent.
 */
function fromVersion4(old: GameState): GameState {
  return {
    ...old,
    version: 5,
    day: old.day - weekdayIndex(old.day),
    arrivals: { ...old.pendingOrders },
    pendingOrders: {},
    stats: { ...old.stats, tips: 0 } as DayStats,
    weather: 'sunny',
    forecast: rollWeather('sunny'),
    reputation: START_REPUTATION,
    rentBehind: 0,
    closed: false,
    totalServed: 0,
  };
}

/** Anyone past the first day has already opened up, so they don't need the first-day guide. */
function fromVersion5(old: GameState): GameState {
  return { ...old, version: SAVE_VERSION, hasOpened: old.day > 1 };
}

/** Returns null when there's no save, or it's unreadable or from a version we can't convert. */
export function loadGame(store: SaveStore): GameState | null {
  try {
    const raw = store.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameState;
    if (parsed.version === SAVE_VERSION) return parsed;
    if (parsed.version === 5) return fromVersion5(parsed);
    return parsed.version === 4 ? fromVersion5(fromVersion4(parsed)) : null;
  } catch {
    return null;
  }
}

export function clearSave(store: SaveStore): void {
  try {
    store.removeItem(SAVE_KEY);
  } catch {
    // Nothing useful to do if storage is blocked.
  }
}
