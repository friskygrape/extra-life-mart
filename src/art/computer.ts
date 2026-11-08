import Phaser from 'phaser';
import { L } from '../layout';

/**
 * The shop computer, cut from the user's art at its exact pixels, recoloured from yellowed beige to light grey with
 * a brighter screen, and smoothed down to about the register's size. It comes in layers, all the same size and stacked at the same corner, so each part can be
 * animated: the body, the desktop on the screen, the window, the window's words, and the power light. The body
 * holds a dimmed light for when the light layer is hidden. Stacked, the layers are the user's art exactly.
 */
const ART_W = 247;
const ART_H = 204;
/** Game pixels per art pixel: close to the register's size. */
const SCALE = 0.36;
const g = (v: number) => v * SCALE;

export const COMPUTER_LAYERS = ['body', 'desktop', 'window', 'words', 'led'] as const;
type Layer = (typeof COMPUTER_LAYERS)[number];
/** The art as loaded, at its own pixels. */
export const computerSource = (layer: Layer) => `computer_${layer}`;
/** The art smoothed to its size on screen. */
const computerKey = (layer: Layer) => `computer_${layer}_shown`;

/** Where the computer's parts sit, in game pixels from its top-left corner. */
export const COMPUTER = {
  w: g(ART_W),
  h: g(ART_H),
  monitorCentreX: g(118),
  screen: { x: g(64), y: g(24), w: g(110), h: g(79) },
  window: { x: g(85), y: g(34), w: g(81), h: g(54) },
  led: { x: g(161), y: g(113), w: g(9), h: g(6) },
};

/**
 * Draws every layer at the screen's own resolution, smoothed, so it stays clean at a size that isn't a whole
 * number of art pixels. Every layer gets the same scaling, so they still line up exactly.
 */
export function createComputer(scene: Phaser.Scene): void {
  const r = L.renderScale;
  for (const layer of COMPUTER_LAYERS) {
    const key = computerKey(layer);
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const tex = scene.textures.createCanvas(key, Math.round(ART_W * SCALE * r), Math.round(ART_H * SCALE * r))!;
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
  body: Phaser.GameObjects.Image;
  desktop: Phaser.GameObjects.Image;
  window: Phaser.GameObjects.Image;
  words: Phaser.GameObjects.Image;
  led: Phaser.GameObjects.Image;
}

/** Puts the computer together at (x, y), with each part kept so it can be animated. */
export function addComputer(scene: Phaser.Scene, x: number, y: number): ComputerParts {
  const [body, desktop, window, words, led] = COMPUTER_LAYERS.map((layer) =>
    scene.add.image(0, 0, computerKey(layer)).setOrigin(0).setScale(1 / L.renderScale),
  );
  const container = scene.add.container(x, y, [body, desktop, window, words, led]);
  return { container, body, desktop, window, words, led };
}
