/** Where everything goes on this screen, in game pixels. */
export interface Layout {
  W: number;
  H: number;
  /** CSS pixels per game pixel. */
  zoom: number;
  hudH: number;
  signY: number;
  windowX: number;
  windowY: number;
  windowW: number;
  windowH: number;
  counterTop: number;
  counterBottom: number;
  shelfTop: number;
  rowH: number;
  stripTop: number;
  stripH: number;
  safeBottom: number;
}

export interface Viewport {
  width: number;
  height: number;
  dpr: number;
  safeTop?: number;
  safeBottom?: number;
}

export const MIN_W = 216;
export const MIN_H = 384;
const MAX_W = 300;
const MAX_H = 640;
const WALL_W = 37;
const BASE_WINDOW_H = 113;
const SIGN_H = 30;
const COUNTER_H = 44;
const BASE_ROW_H = 49;
const MAX_ROW_H = 74;
const STRIP_H = 32;

/**
 * Picks the largest whole number of device pixels per game pixel that fits the
 * minimum layout, then sizes the game to fill the screen, so the art stays crisp
 * on every device. Wide or very tall screens are capped and centred.
 */
export function computeLayout({ width, height, dpr, safeTop = 0, safeBottom = 0 }: Viewport): Layout {
  const deviceW = width * dpr;
  const deviceH = height * dpr;
  const whole = Math.min(Math.floor(deviceW / MIN_W), Math.floor(deviceH / MIN_H));
  // Below the minimum there's no whole size that fits, so the minimum layout scales down.
  const scale = whole >= 1 ? whole : Math.min(deviceW / MIN_W, deviceH / MIN_H);
  const fullH = whole >= 1 ? Math.ceil(deviceH / scale) : MIN_H;
  const H = Math.min(fullH, MAX_H);
  const fullW = whole >= 1 ? Math.ceil(deviceW / scale) : MIN_W;
  const W = Math.max(MIN_W, Math.min(fullW, MAX_W, Math.floor(H * 0.72)));

  const safeTopPx = Math.ceil((safeTop * dpr) / scale);
  const safeBottomPx = Math.ceil((safeBottom * dpr) / scale);
  const hudH = 15 + safeTopPx;
  const stripH = STRIP_H + safeBottomPx;

  // Spare height goes to the window and shelf rows.
  const fixed = hudH + SIGN_H + BASE_WINDOW_H + COUNTER_H + 1 + BASE_ROW_H * 3 + stripH;
  const spare = Math.max(0, H - fixed);
  const rowExtra = Math.min(MAX_ROW_H - BASE_ROW_H, Math.floor((spare * 0.55) / 3));
  const rowH = BASE_ROW_H + rowExtra;
  const windowH = BASE_WINDOW_H + spare - rowExtra * 3;

  const windowY = hudH + SIGN_H;
  const counterTop = windowY + windowH;
  const counterBottom = counterTop + COUNTER_H;
  const shelfTop = counterBottom + 1;
  return {
    W,
    H,
    zoom: scale / dpr,
    hudH,
    signY: hudH + 3,
    windowX: WALL_W,
    windowY,
    windowW: W - WALL_W * 2,
    windowH,
    counterTop,
    counterBottom,
    shelfTop,
    rowH,
    stripTop: shelfTop + rowH * 3,
    stripH,
    safeBottom: safeBottomPx,
  };
}

/** Set once at startup, before the game is created. */
export let L: Layout;

export function setLayout(layout: Layout): void {
  L = layout;
}

// Shared spots around the customer, used by the shop and the payment screen.
export const portraitX = () => L.windowX + 43;
export const bubbleX = () => portraitX() + 27;
export const bubbleY = () => L.windowY + 8;
export const bubbleW = () => Math.min(130, L.W - bubbleX() - 3);

/** Height of a printed receipt with this many item lines. */
export const receiptHeight = (lines: number) => 18 + lines * 9;
