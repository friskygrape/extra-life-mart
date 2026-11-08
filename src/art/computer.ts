import Phaser from 'phaser';
import { L } from '../layout';

/**
 * The shop computer, cut from the user's art at its exact pixels, recoloured to an old PC's off-white with a brighter
 * screen, and smoothed down to about the register's size.
 *
 * It comes in layers, all cut from the same 247 × 204 picture, so each part can be animated: the desk things
 * (keyboard, mouse and cables), the monitor's body, the desktop on its screen, the window, the window's words,
 * and the power light. The monitor is shown a little larger than the desk things; both grow from the foot of the
 * stand, where the cables tuck behind it, so they still meet.
 */
const ART_W = 247;
const ART_H = 204;
/** Game pixels per art pixel for each group. */
const MONITOR_SCALE = 0.41;
const DESK_SCALE = 0.32;
/** The foot of the stand, in the art's pixels: both groups scale from here. */
const ANCHOR = { x: 120, y: 146 };
/** What each group covers in the art, for working out the whole computer's size. */
const MONITOR_ART = { x0: 47, y0: 1, x1: 193, y1: 147 };
const DESK_ART = { x0: 8, y0: 128, x1: 247, y1: 204 };

export const COMPUTER_LAYERS = ['desk', 'body', 'desktop', 'window', 'words', 'led'] as const;
type Layer = (typeof COMPUTER_LAYERS)[number];
const scaleOf = (layer: Layer) => (layer === 'desk' ? DESK_SCALE : MONITOR_SCALE);

/** The art as loaded, at its own pixels. */
export const computerSource = (layer: Layer) => `computer_${layer}`;
/** The art smoothed to its size on screen. */
const computerKey = (layer: Layer) => `computer_${layer}_shown`;

// Where the anchor lands, measured from the top-left of everything
const left = Math.min(ANCHOR.x - (ANCHOR.x - MONITOR_ART.x0) * MONITOR_SCALE, ANCHOR.x - (ANCHOR.x - DESK_ART.x0) * DESK_SCALE);
const right = Math.max(ANCHOR.x + (MONITOR_ART.x1 - ANCHOR.x) * MONITOR_SCALE, ANCHOR.x + (DESK_ART.x1 - ANCHOR.x) * DESK_SCALE);
const top = ANCHOR.y - (ANCHOR.y - MONITOR_ART.y0) * MONITOR_SCALE;
const bottom = ANCHOR.y + (DESK_ART.y1 - ANCHOR.y) * DESK_SCALE;
const anchorX = ANCHOR.x - left;
const anchorY = ANCHOR.y - top;
/** A point in the monitor's art, in game pixels from the computer's top-left corner. */
const onMonitor = (x: number, y: number) => ({ x: anchorX + (x - ANCHOR.x) * MONITOR_SCALE, y: anchorY + (y - ANCHOR.y) * MONITOR_SCALE });

const screenTopLeft = onMonitor(64, 24);
/** Where the computer's parts sit, in game pixels from its top-left corner. */
export const COMPUTER = {
  w: right - left,
  h: bottom - top,
  monitorCentreX: onMonitor(120, 0).x,
  screen: { x: screenTopLeft.x, y: screenTopLeft.y, w: 110 * MONITOR_SCALE, h: 79 * MONITOR_SCALE },
};

/**
 * Draws every layer at the screen's own resolution, smoothed, so it stays clean at a size that isn't a whole
 * number of art pixels. Layers in the same group get the same scaling, so they still line up exactly.
 */
export function createComputer(scene: Phaser.Scene): void {
  const r = L.renderScale;
  for (const layer of COMPUTER_LAYERS) {
    const key = computerKey(layer);
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const s = scaleOf(layer);
    const tex = scene.textures.createCanvas(key, Math.round(ART_W * s * r), Math.round(ART_H * s * r))!;
    const c = tex.getContext();
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'high';
    c.drawImage(scene.textures.get(computerSource(layer)).getSourceImage() as HTMLImageElement, 0, 0, tex.width, tex.height);
    tex.refresh();
    tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
  }
}

export interface ComputerParts {
  container: Phaser.GameObjects.Container;
  desk: Phaser.GameObjects.Image;
  body: Phaser.GameObjects.Image;
  desktop: Phaser.GameObjects.Image;
  window: Phaser.GameObjects.Image;
  words: Phaser.GameObjects.Image;
  led: Phaser.GameObjects.Image;
}

/** Puts the computer together with its top-left at (x, y), with each part kept so it can be animated. */
export function addComputer(scene: Phaser.Scene, x: number, y: number): ComputerParts {
  const [desk, body, desktop, window, words, led] = COMPUTER_LAYERS.map((layer) => {
    const s = scaleOf(layer);
    // Each layer's picture starts at the art's corner, so place that corner where the anchor's scaling puts it.
    const snap = (v: number) => Math.round(v * L.renderScale) / L.renderScale;
    return scene.add.image(snap(anchorX - ANCHOR.x * s), snap(anchorY - ANCHOR.y * s), computerKey(layer)).setOrigin(0).setScale(1 / L.renderScale);
  });
  const container = scene.add.container(x, y, [desk, body, desktop, window, words, led]);
  return { container, desk, body, desktop, window, words, led };
}
