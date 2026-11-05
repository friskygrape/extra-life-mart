import Phaser from 'phaser';
import { loadGame, saveGame, clearSave, type SaveStore } from './logic/save';
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
  return override > 0 ? override : 180;
}

class Session {
  state: GameState = loadGame(store()) ?? newGame();
  phase: Phase = 'morning';
  modal = false;
  clock = 0;
  readonly dayLength = dayLengthSeconds();
  queueReady = 0;
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

  /** 9:00 at opening to 17:00 at closing. */
  clockLabel(): string {
    const fraction = this.phase === 'morning' ? 0 : Math.min(1, this.clock / this.dayLength);
    const minutes = 9 * 60 + Math.floor((fraction * 8 * 60) / 10) * 10;
    return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
  }
}

export const session = new Session();
