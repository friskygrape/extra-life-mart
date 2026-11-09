import Phaser from 'phaser';
import { clockLabel } from './logic/clock';
import { loadGame, saveGame, clearSave, type SaveStore } from './logic/save';
import { finishAppliances, unlockOwned } from './logic/appliances';
import { newGame, type GameState } from './logic/state';

export type Phase = 'morning' | 'open' | 'closing' | 'summary';

/** What's on the register screen right now (also read by the browser test). */
export interface ActiveSale {
  items: string[];
  total: number;
  paidByCash: boolean;
  tendered: number;
}

const memoryFallback: SaveStore = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

function store(): SaveStore {
  try {
    return window.localStorage ?? memoryFallback;
  } catch {
    return memoryFallback;
  }
}

function dayLengthSeconds(): number {
  // Dev-only override so a full day can be tested quickly: ?day=20
  const override = import.meta.env.DEV ? Number(new URLSearchParams(location.search).get('day')) : 0;
  return override > 0 ? override : 210;
}

class Session {
  state: GameState = loadedGame();
  phase: Phase = 'morning';
  modal = false;
  clock = 0;
  readonly dayLength = dayLengthSeconds();
  waiting = 0;
  wants: string[] | null = null;
  /** Seconds the current customer has been waiting on you, which sets their tip. */
  serviceSeconds = 0;
  /** True while the receipt and money appear, so the animation never costs a tip. */
  servicePaused = false;
  payingCash = false;
  table: string[] = [];
  sale: ActiveSale | null = null;
  message = '';
  messageUntil = 0;
  readonly events = new Phaser.Events.EventEmitter();

  save() {
    saveGame(this.state, store());
  }

  reset() {
    clearSave(store());
    this.state = newGame();
    this.save();
  }

  toast(text: string, ms = 2500) {
    this.message = text;
    this.messageUntil = performance.now() + ms;
  }

  /** How far through the day we are, from 0 at opening to 1 at closing. */
  dayFraction(): number {
    return this.phase === 'morning' ? 0 : Math.min(1, this.clock / this.dayLength);
  }

  clockLabel(): string {
    return clockLabel(this.dayFraction());
  }
}

export const session = new Session();

/** The saved game, with any machine that was running when it was saved now finished. */
function loadedGame(): GameState {
  const state = loadGame(store()) ?? newGame();
  finishAppliances(state);
  unlockOwned(state);
  return state;
}
