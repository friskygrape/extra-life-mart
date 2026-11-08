import Phaser from 'phaser';

/**
 * The shop computer, cut from the user's art at its exact pixels and shown at half a game pixel per art pixel,
 * like the register. It comes in layers, all the same size and stacked at the same corner, so each part can be
 * animated: the body, the desktop on the screen, the window, the window's words, and the power light. The body
 * holds a dimmed light for when the light layer is hidden. Stacked, the layers are the user's art exactly.
 */
const ART_W = 247;
const ART_H = 204;
const SCALE = 0.5;
const g = (v: number) => v * SCALE;

export const COMPUTER_LAYERS = ['body', 'desktop', 'window', 'words', 'led'] as const;
type Layer = (typeof COMPUTER_LAYERS)[number];
export const computerKey = (layer: Layer) => `computer_${layer}`;

/** Where the computer's parts sit, in game pixels from its top-left corner. */
export const COMPUTER = {
  w: g(ART_W),
  h: g(ART_H),
  monitorCentreX: g(118),
  screen: { x: g(64), y: g(24), w: g(110), h: g(79) },
  window: { x: g(85), y: g(34), w: g(81), h: g(54) },
  led: { x: g(161), y: g(113), w: g(9), h: g(6) },
};

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
    scene.add.image(0, 0, computerKey(layer)).setOrigin(0).setScale(SCALE),
  );
  const container = scene.add.container(x, y, [body, desktop, window, words, led]);
  return { container, body, desktop, window, words, led };
}
