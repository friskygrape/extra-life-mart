import { SAVE_VERSION, type GameState } from './state';

const SAVE_KEY = 'extra-life-mart-save';

export type SaveStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function saveGame(state: GameState, store: SaveStore): void {
  try {
    store.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // Private browsing or a full disk: the game still plays, it just won't persist.
  }
}

/** Returns null when there's no save, or it's unreadable or from another version. */
export function loadGame(store: SaveStore): GameState | null {
  try {
    const raw = store.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameState;
    return parsed.version === SAVE_VERSION ? parsed : null;
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
